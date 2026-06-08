# Diário de desenvolvimento — Cabecinha Bot

Esse arquivo é meu caderninho de bordo do projeto. Cada entrada é um momento — o que tava fazendo, o que me travou, o que descobri, o que mudei de ideia. Sem rigor de changelog, sem template engessado. É pra eu e quem tiver curioso entender **por que** as coisas viraram do jeito que viraram.

Ordem: mais recente em cima.

---

## 2026-06-08 (continuação) — Fix do transcode validado, novo gargalo aparece

Rodei o bot com o `playbackConfig` plugado e os números falaram alto:

```
t+23028ms primeiro byte do yt-dlp recebido
t+23036ms AudioPlayerStatus.Playing
```

**8ms** entre o primeiro byte chegar e o áudio efetivamente começar. Antes esse gap era de vários segundos (probe + ffmpeg). Hipótese confirmada: era o transcode mesmo o vilão da etapa final.

**Mas o log revelou o que ficava escondido:** o `yt-dlp` leva ~21s entre ser spawnado e cuspir o primeiro byte. Esse gargalo sempre existiu, só ficava mascarado pelo ffmpeg trabalhando em cima. Conserto um problema, descubro o próximo — clássico de profiling: você só vê o segundo gargalo depois de remover o primeiro.

**Próxima otimização aplicada (mesma sessão, mesmo TDD):** `extractor-args "youtube:player_client=android"`. O cliente Android do YouTube pula a etapa de decoding de signature do player JS (que é o ponto lento da extração no cliente web). Adicionei o teste no `playbackConfig.test.js`, vi vermelho, estendi o `buildPlaybackConfig()`, ficou verde, pluguei no `~play`. Espero que corte boa parte dos 21s — vou re-medir.

**Anomalia menor pra investigar depois:** entre `yt-dlp spawnado` e `AudioResource criado` deu 2.5s, e ali são 4 statements síncronos. Suspeito de overhead do `yt-dlp-exec` (verificação de binary, bootstrap interno). Baixa prioridade, mas anotado.

**Outras coisas dessa rodada:**

- `package.json` limpo: saíram `botmusic-cabecinha` (auto-referência boba), `i` (typo de `npm i`), `npm` (não faz sentido como dep do projeto), `@distube/ytdl-core` e `play-dl` (sobras da era pré-yt-dlp). 222 pacotes saíram do `node_modules`. Mantive `opusscript` como fallback caso algum vídeo não tenha trilha webm/opus.
- `npm audit` apontou um CVE crítico no Vitest (`GHSA-5xrq-8626-4rwp`), mas só é explorável quando você roda `vitest --ui` (servidor web). A gente usa `vitest run` (CLI). Decisão: deixa como tá. Subir pra 4.x reabriria o problema do Rolldown no Windows que já documentei.
- `@discordjs/voice@0.19.2` quer Node >=22.12, eu tô no 20.15. Só warning, não erro. Na Oracle vou instalar Node 22 direto e resolve.

---

## 2026-06-08 — Rede confirmada como vilã, plano de otimização local antes da nuvem

O `NetworkWatcher` pagou o investimento já no primeiro dia útil: rodei o bot com call aberta e terminal disputando uplink, e os logs `[NET]` confirmaram **perda de pacote real**, não suspeita. Pra fechar o diagnóstico, lembrei que o módulo wifi do notebook tá com problema de hardware há um tempo — então é a soma: rede local instável + hardware degradado + ambiente concorrendo (call/terminal).

Conclusão imediata: **migrar pra Oracle Cloud não é mais "vou fazer um dia", é parte do conserto do bug.** O delay nunca vai cair pra zero rodando aqui, por melhor que eu otimize.

**Mas antes de subir, otimização local primeiro.** Lógica: o que conserto agora vale tanto local quanto na nuvem, e separa o que é "minha rede" do que é "o bot tá lento de fato". Se eu subir sem otimizar, vou perseguir gargalo errado depois.

**Plano dessa rodada (TDD em tudo que for novo):**

1. **Fix do delay — eliminar transcode do ffmpeg.** Hoje o `~play` usa `format: 'bestaudio'` genérico + `StreamType.Arbitrary`, o que força o `@discordjs/voice` a chamar ffmpeg pra converter pra opus (que é o que o Discord aceita). Mas o YouTube já entrega opus em container webm — se eu pedir explicitamente `bestaudio[ext=webm][acodec=opus]` e usar `StreamType.WebmOpus`, o stream vai direto, sem transcode. Menos CPU, primeiro pacote sai mais cedo, e ainda é mais resiliente em rede ruim porque o payload é menor.
2. **Extrair `playbackConfig`** — função pura que devolve `{ ytdlpFormat, streamType }`. Testar isso é trivial (entrada/saída), e abre caminho pra TDD em cima dos formatos sem ter que mockar Discord inteiro. Vai contra o "não criar abstração à toa", mas aqui o ganho é real: o `~play` hoje é uma função-monstro inline dentro do `messageCreate`, intestável.
3. **Limpar `package.json`.** Tem entulho que veio de typos e tentativas antigas: `botmusic-cabecinha` (auto-referência), `i` e `npm` (typo de `npm i`), `@distube/ytdl-core` (substituído pelo `yt-dlp`), `play-dl` (idem). Some tudo. `opusscript` fica como fallback caso algum vídeo não tenha trilha webm/opus.

Depois disso, rodar `~play` de novo, ver o `[PLAY][t+Xms] Playing` cair perto do `primeiro byte` (sem o gap do ffmpeg fazendo transcode), e aí sim partir pra migração Oracle em sessão separada.

---

## 2026-06-06 (continuação) — TDD na prática: nasce o NetworkWatcher

Rodei o bot pela primeira vez depois da migração pro `.env` e bateu na cara dura: **2 minutos pra começar a tocar uma música**. O bot diz "JA TA TOCANDO PAPAI" quase instantâneo, mas o áudio leva uma eternidade pra sair. Antes ele demorava uns 30 segundos, hoje deu 2 min, ou seja, varia. Suspeito da minha rede também — tô rodando local, e qualquer fricção na conexão com YouTube ou Discord vai aparecer aqui.

Já dei como bug, vai virar o **primeiro debug oficial do projeto**. E como agora tô fazendo TDD, isso significa: teste antes do fix, sempre.

**Decisão imediata:** antes de tentar consertar, eu preciso de **dados**. Não dá pra otimizar no escuro. Então fizemos duas coisas em paralelo:

1. **`NetworkWatcher`** — service novo pra monitorar latência até YouTube e Discord enquanto o bot tá rodando. A cada 15s ele dispara um HEAD em três endpoints (`www.youtube.com`, `i.ytimg.com`, `discord.com/api/v10/gateway`) e loga o RTT. Se passar de 800ms, ele cuspe um aviso `[NET][DEGRADED]`. Também tem método `checkOnce()` pra tirar snapshot pontual.
2. **Instrumentação no `~play`** — agora cada etapa do pipeline (join voice, spawn yt-dlp, primeiro byte do stream, createAudioResource, player.play, e o `AudioPlayerStatus.Playing` que dispara quando o áudio COMEÇA DE VERDADE) tem um log `[PLAY][t+Xms]`. Vou conseguir ver onde os segundos são gastos.

**TDD aplicado de verdade pela primeira vez nesse projeto:**

Escrevi os testes do NetworkWatcher antes do código. 10 testes cobrindo: `checkOnce` com sucesso, erro, timeout, múltiplos targets em paralelo, `start/stop` periódico, eventos `check` e `degraded`. Rodei → tudo vermelho (módulo não existia). Implementei → ficou tudo verde. Quase tudo.

**Bobagem que aprendi:** o teste de `degraded` falhou por timeout. O motivo me pegou de surpresa — eu tava usando `vi.useFakeTimers()` no `beforeEach`, e dentro do mock do fetcher eu usava `setTimeout(() => resolve, 500)` pra simular latência. Só que com fake timers ativos, esse `setTimeout` também era fake e nunca disparava. A promise do mock nunca resolvia → o teste travava 5s → vitest matava por timeout.

Conserto: avançar o timer manualmente dentro do teste.

```js
const promessa = watcher.checkOnce();
await vi.advanceTimersByTimeAsync(600);
await promessa;
```

Anotado pro futuro: **com fake timers, todo `setTimeout` precisa ser disparado manualmente, inclusive os que eu mesmo coloco nos mocks.** Tem hora que ferramenta poderosa vira armadilha.

**Mudança colateral:** convertemos o `cabecinhabot.js` de CommonJS pra ESM (`import` em vez de `require`). O `NetworkWatcher` nasceu ESM (Vitest é nativo ESM), e em vez de gambiarrar com dynamic import, virei a chave de uma vez. Adicionei `"type": "module"` no `package.json`. Funcionou sem nenhum efeito colateral nas dependências (discord.js, ffmpeg-static, yt-dlp-exec, dotenv — todos têm export ESM compatível).

**O que falta pra fechar o debug:**

Rodar o bot agora com a instrumentação, dar um `~play` e olhar o log. A linha de tempo vai me dizer:

- Se `joinVoiceChannel → READY` demora muito → problema é handshake do Discord
- Se `READY → yt-dlp primeiro byte` demora muito → problema é yt-dlp resolvendo o vídeo
- Se `primeiro byte → AudioPlayerStatus.Playing` demora muito → problema é probe do `createAudioResource` ou buffer inicial
- Se o `[NET]` mostrar RTT alto → minha rede tá ruim mesmo e parte do problema é local

Depois disso, escrever teste que reproduz o gargalo e atacar com fix (provavelmente: `format: 'bestaudio[ext=webm][acodec=opus]'` + `inputType: StreamType.WebmOpus` pra eliminar transcode).

---

O bot tava funcionando, mas era um arquivo só, sem fila, com travamento aleatório no `yt-dlp` e o token do Discord dando sopa no `config.json`. Resolvi sentar e tratar o projeto como projeto de verdade, não mais como "experimento de fim de semana que não morreu".

**O que decidi fazer agora:**

1. Tirar o token do `config.json` e botar no `.env` (com `.env.example` pra commitar). Já tava pedindo.
2. Criar `.gitignore` decente — surreal eu não ter um.
3. Documentar tudo no README com badges, arquitetura desenhada (Mermaid), MER e DER. Se vai ficar no portfólio, tem que vender o peixe direito.
4. Trocar deploy de AWS pra Oracle Cloud Always Free. AWS Free Tier expira em 12 meses, Oracle não expira nunca, e ainda dá 4 vCPUs ARM com 24GB de RAM. É overkill, mas overkill grátis e tranquilo é o melhor tipo de overkill.

**Aprendizado da rodada:**

- `config.json` versionado é tiro no pé. Mesmo em projeto pessoal. A pegadinha é que mesmo se você nunca subir pro GitHub, o histórico do git já guarda. Token tem que sair de lá **antes** do primeiro commit.
- O `git push -u origin main` não funciona se você ainda não rodou `git add` + `git commit`. O `main` literalmente não existe sem commit apontando pra ele. Bobeira boba que me custou uns 10 minutos.
- Mermaid no GitHub renderiza sozinho — descobri agora. Achei que ia precisar de extensão ou imagem. Dá pra documentar arquitetura no próprio README sem virar PNG.

**Depois disso, decidi adotar TDD pra valer no projeto.**

Faz sentido: refatoração grande chegando, vou mexer em service de música que tem comportamento async, fila de estado, retry de stream… esse tipo de coisa sem teste é receita pra eu quebrar feature antiga sem perceber. Red → green → refactor pra todo módulo novo a partir de agora.

Escolhi **Vitest** em vez de Jest:
- API quase igual ao Jest, então a curva de aprendizado é zero
- Mais rápido, ESM-first
- Watch mode bom de verdade

**Aprendizado já no setup do Vitest:**

- Vitest 4.x usa um engine novo chamado **Rolldown** (sucessor do Rollup, escrito em Rust). No Windows ele tenta carregar um binding nativo `.node` que **não baixa direito** na instalação padrão. Quebrou na primeira execução de `npm test` com `Cannot find module './rolldown-binding.win32-x64-msvc.node'`.
- Solução: **downgrade pra Vitest 3.x** (que ainda usa Vite/esbuild puro). Funciona perfeito no Windows. Vou ficar no 3 até o ecossistema Rolldown estabilizar.
- Lição: versão mais nova nem sempre é a versão certa, principalmente em ferramenta de build.
- Estrutura adotada: `tests/` espelhando `src/`, scripts `npm test` (run único) e `npm test:watch` (modo dev). Coverage com `v8`.

---

## Antes de existir esse diário

O bot já estava de pé com o básico:

- Comandos `~play`, `~pause`, `~resume`, `~stop`, `~disconnect` funcionando
- `yt-dlp` como extrator (depois de descobrir que `ytdl-core` quebra toda semana porque o YouTube muda o player)
- `@discordjs/voice` cuidando do streaming
- `ffmpeg-static` empacotando o ffmpeg sem precisar instalar no SO

**Coisa que aprendi na marra antes desse diário existir:**

- `ytdl-core` é frágil. Não vale a pena lutar — migra logo pro `yt-dlp`.
- Sem `ffmpeg-static`, dá um trabalho enorme garantir que o ffmpeg tá no PATH dentro do container Docker. Esse pacote resolve.
- A intent `GuildVoiceStates` é obrigatória, senão `joinVoiceChannel` falha calado. Demorou pra eu entender que o problema não era código, era a intent faltando no client.
- O `@discordjs/voice` precisa do `tweetnacl` ou `sodium` pra criptografia. Sem isso, conecta mas não toca som. Easter egg horrível.

---

*Próximas entradas vão vir conforme eu implementar a fila, o visualizer e o resto do roadmap.*
