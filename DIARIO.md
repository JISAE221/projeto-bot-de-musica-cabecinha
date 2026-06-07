# Diário de desenvolvimento — Cabecinha Bot

Esse arquivo é meu caderninho de bordo do projeto. Cada entrada é um momento — o que tava fazendo, o que me travou, o que descobri, o que mudei de ideia. Sem rigor de changelog, sem template engessado. É pra eu e quem tiver curioso entender **por que** as coisas viraram do jeito que viraram.

Ordem: mais recente em cima.

---

## 2026-06-06 — Bora estruturar isso aqui

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
