# Cabecinha Bot

Bot de música para Discord escrito em Node.js, com foco em streaming resiliente, fila persistente, integração multi-plataforma (YouTube + Spotify) e deploy containerizado em nuvem.

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js"/>
  <img src="https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white" alt="FFmpeg"/>
  <img src="https://img.shields.io/badge/yt--dlp-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="yt-dlp"/>
  <img src="https://img.shields.io/badge/Spotify-1DB954?style=for-the-badge&logo=spotify&logoColor=white" alt="Spotify"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/Oracle_Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white" alt="Oracle Cloud"/>
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License"/>
</p>

---

## Sobre o projeto

Cabecinha Bot nasceu como um experimento pessoal de streaming de áudio em tempo real via WebSocket no Discord e evoluiu para um estudo prático de arquitetura de serviços, modelagem de dados e deploy em nuvem.

O projeto explora:

- Streaming de áudio com `@discordjs/voice` e `ffmpeg`
- Extração resiliente de mídia com `yt-dlp` (substituto do `ytdl-core`)
- Containerização com Docker para isolamento e portabilidade
- Deploy em nuvem com Oracle Cloud (Always Free)
- Integração OAuth 2.0 com APIs externas (Spotify Web API)
- Modelagem relacional com PostgreSQL e cache transacional em Redis
- Telemetria de uso e estatísticas agregadas

---

## Status atual

| Funcionalidade           | Estado            |
| ------------------------ | ----------------- |
| Play / Pause / Resume    | Implementado      |
| Stop / Disconnect        | Implementado      |
| Fila de músicas          | Em desenvolvimento|
| Autoplay                 | Em desenvolvimento|
| Visualizer com progress bar | Em desenvolvimento|
| Integração Spotify (OAuth)  | Planejado      |
| Importação de playlists (YT/Spotify) | Planejado |
| Estatísticas agregadas   | Planejado         |
| Deploy em produção       | Planejado         |

---

## Stack técnica

| Camada           | Tecnologia                                    |
| ---------------- | --------------------------------------------- |
| Runtime          | Node.js 22                                    |
| Bot framework    | discord.js v14 + @discordjs/voice             |
| Extração de mídia| yt-dlp (via `yt-dlp-exec`)                    |
| Transcoding      | FFmpeg (`ffmpeg-static`)                      |
| Persistência     | PostgreSQL                                    |
| Cache / fila     | Redis                                         |
| Empacotamento    | Docker                                        |
| Hospedagem       | Oracle Cloud (VM Ampere ARM / Always Free)    |

---

## Executando localmente

### Pré-requisitos

- Node.js 22 ou superior
- Python 3 (dependência interna do `yt-dlp`)
- FFmpeg (fornecido via `ffmpeg-static`, não requer instalação manual)

### Passos

```bash
git clone https://github.com/<seu-user>/botmusic-cabecinha.git
cd botmusic-cabecinha

npm install

cp .env.example .env
# Edite o .env e preencha DISCORD_TOKEN

node cabecinhabot.js
```

### Executando via Docker

```bash
docker build -t cabecinha .
docker run --env-file .env cabecinha
```

---

## Comandos disponíveis

| Comando               | Descrição                                  |
| --------------------- | ------------------------------------------ |
| `~play <url>`         | Reproduz áudio a partir de uma URL do YouTube |
| `~pause`              | Pausa a reprodução                         |
| `~resume`             | Retoma a reprodução                        |
| `~stop`               | Interrompe a faixa atual                   |
| `~disconnect` / `~dc` | Desconecta o bot do canal de voz           |
| `~help`               | Exibe a lista de comandos                  |

O comando de desconexão exige que o solicitante esteja no mesmo canal de voz que o bot, como medida básica de controle de acesso.

---

## Arquitetura

Visão lógica dos componentes e do fluxo de dados quando uma requisição de reprodução é processada:

```mermaid
flowchart TB
    User["Usuário no Discord"]

    subgraph DiscordPlat["Discord"]
        Gateway["Gateway WebSocket"]
        VoiceChan["Canal de Voz"]
    end

    subgraph Cloud["Oracle Cloud (Always Free)"]
        subgraph Docker["Container Docker"]
            subgraph Core["Núcleo do Bot"]
                CmdRouter["Roteador de Comandos"]
                EventBus["Event Bus interno"]
            end

            subgraph Servicos["Camada de Serviços"]
                PlayerSvc["PlayerService<br/>progress bar e autoplay"]
                QueueSvc["QueueService<br/>fila, shuffle e loop"]
                PlaylistSvc["PlaylistService<br/>sync YT e Spotify"]
                StatsSvc["StatsService<br/>top faixas e tempo"]
                VizSvc["VisualizerService<br/>embed dinâmico"]
                AuthSvc["AuthService<br/>OAuth Spotify"]
            end

            subgraph Resolvers["Resolvers de Mídia"]
                Resolver["URL Resolver<br/>detecção de plataforma"]
                YTAdapter["YouTube Adapter<br/>yt-dlp com retry"]
                SpotAdapter["Spotify Adapter<br/>somente metadata"]
                Matcher["ISRC Matcher<br/>Spotify para YT stream"]
            end

            FFmpeg["FFmpeg<br/>transcode para Opus"]
            VoiceConn["@discordjs/voice"]
        end

        DB[("PostgreSQL<br/>faixas, playlists, stats")]
        Cache[("Redis<br/>fila viva e cache yt-dlp")]
    end

    SpotifyAPI["Spotify Web API"]
    YouTube["YouTube"]

    User -->|comandos| Gateway
    Gateway <--> CmdRouter
    CmdRouter --> EventBus

    EventBus --> PlayerSvc
    EventBus --> QueueSvc
    EventBus --> PlaylistSvc
    EventBus --> AuthSvc

    PlaylistSvc -->|importar| Resolver
    QueueSvc --> Resolver
    Resolver -->|link YT| YTAdapter
    Resolver -->|link Spotify| SpotAdapter
    SpotAdapter --> Matcher
    Matcher -->|busca equivalente| YTAdapter

    YTAdapter -.-> YouTube
    SpotAdapter -.-> SpotifyAPI
    AuthSvc <-.->|OAuth refresh| SpotifyAPI

    YTAdapter --> FFmpeg
    FFmpeg --> VoiceConn
    VoiceConn --> VoiceChan

    PlayerSvc -->|tick 1s| VizSvc
    VizSvc -->|edit embed| Gateway
    PlayerSvc -->|onIdle| QueueSvc
    PlayerSvc -->|autoplay| PlaylistSvc

    PlayerSvc --> StatsSvc
    StatsSvc --> DB
    PlaylistSvc --> DB
    QueueSvc --> Cache
    YTAdapter -.->|cache stream url| Cache
    AuthSvc --> DB
```

### Decisões de arquitetura

- **`yt-dlp` em vez de `ytdl-core`**: o YouTube quebra a compatibilidade do `ytdl-core` com frequência. O `yt-dlp` apresenta resiliência significativamente maior, ao custo da dependência de Python no runtime.
- **Spotify apenas para metadata**: a Web API do Spotify não permite streaming de áudio. O fluxo correto é obter metadados (título, artista, ISRC) no Spotify e localizar a faixa equivalente no YouTube via matcher. Esse é o padrão adotado pela maioria dos bots de música.
- **Redis como camada de fila e cache**: a fila opera em memória, mas precisa sobreviver a reinícios de container. Redis oferece persistência leve e TTL nativo, ideal para cachear URLs de stream do `yt-dlp` (que expiram).
- **VM dedicada em vez de serverless**: bots de música mantêm conexões WebSocket persistentes e processos de longa duração, o que torna soluções como AWS Lambda ou Cloud Run inadequadas. Uma VM Ampere ARM do Oracle Always Free atende ao perfil com folga.

---

## Modelagem de dados

### Modelo Entidade-Relacionamento (MER)

A modelagem desacopla a entidade `FAIXA` da entidade `FONTE` para resolver o cenário de crossover Spotify ↔ YouTube. A mesma faixa pode ter registros em múltiplas fontes e ser correlacionada por ISRC, garantindo deduplicação semântica.

```mermaid
erDiagram
    USUARIO ||--o{ SESSAO_VOZ : inicia
    USUARIO ||--o{ PLAYLIST : possui
    USUARIO ||--o{ CONTA_INTEGRACAO : vincula
    USUARIO ||--o{ ITEM_FILA : pede
    USUARIO ||--o{ HISTORICO_REPRODUCAO : ouve
    USUARIO ||--o{ ESTATISTICA_USUARIO : acumula

    SERVIDOR ||--o{ SESSAO_VOZ : hospeda
    SERVIDOR ||--|| ESTATISTICA_SERVIDOR : agrega
    SERVIDOR ||--o{ ESTATISTICA_USUARIO : contextualiza

    SESSAO_VOZ ||--|| FILA : tem
    SESSAO_VOZ ||--o{ HISTORICO_REPRODUCAO : registra

    FILA ||--o{ ITEM_FILA : contem

    FAIXA ||--o{ ITEM_FILA : referenciada
    FAIXA ||--o{ PLAYLIST_ITEM : aparece
    FAIXA ||--o{ HISTORICO_REPRODUCAO : tocada
    FAIXA }o--|| FONTE : origem

    PLAYLIST ||--o{ PLAYLIST_ITEM : contem

    USUARIO {
        string id_usuario PK "Discord snowflake"
        string nome
        datetime data_cadastro
    }
    SERVIDOR {
        string id_servidor PK "Guild snowflake"
        string nome
        string prefixo_comando
        string canal_padrao_id
    }
    CONTA_INTEGRACAO {
        uuid id_integracao PK
        string id_usuario FK
        string provedor "spotify | youtube"
        string access_token
        string refresh_token
        datetime expira_em
    }
    SESSAO_VOZ {
        uuid id_sessao PK
        string id_servidor FK
        string id_canal_voz
        string id_usuario_iniciou FK
        datetime iniciada_em
        datetime finalizada_em
        string status "ativa | pausada | encerrada"
    }
    FILA {
        uuid id_fila PK
        uuid id_sessao FK
        string modo_repeticao "none | one | all"
        boolean modo_aleatorio
        boolean autoplay
        int volume
    }
    ITEM_FILA {
        uuid id_item PK
        uuid id_fila FK
        uuid id_faixa FK
        int posicao
        string adicionada_por FK
        datetime adicionada_em
        boolean tocada
    }
    FAIXA {
        uuid id_faixa PK
        string titulo
        string artista
        int duracao_ms
        string url_origem
        uuid id_fonte FK
        string thumbnail_url
        string isrc "identificador internacional"
    }
    FONTE {
        uuid id_fonte PK
        string tipo "youtube | spotify | soundcloud"
        string identificador_externo
    }
    PLAYLIST {
        uuid id_playlist PK
        string id_usuario_dono FK
        string nome
        string descricao
        boolean privada
        string provedor_origem "local | spotify | youtube"
        string id_externo
        datetime criada_em
    }
    PLAYLIST_ITEM {
        uuid id_playlist_item PK
        uuid id_playlist FK
        uuid id_faixa FK
        int posicao
        datetime adicionada_em
    }
    HISTORICO_REPRODUCAO {
        uuid id_historico PK
        uuid id_faixa FK
        uuid id_sessao FK
        string id_usuario FK
        datetime iniciou_em
        datetime terminou_em
        int ms_reproduzidos
        boolean pulada
    }
    ESTATISTICA_SERVIDOR {
        uuid id_estatistica PK
        string id_servidor FK
        int total_faixas_tocadas
        bigint total_ms_reproduzidos
        datetime ultima_atualizacao
    }
    ESTATISTICA_USUARIO {
        uuid id_estatistica PK
        string id_usuario FK
        string id_servidor FK
        int total_faixas_pedidas
        bigint total_ms_ouvidos
    }
```

### Dicionário de entidades

| Entidade               | Responsabilidade                                                  |
| ---------------------- | ----------------------------------------------------------------- |
| `USUARIO`              | Identifica solicitantes de reprodução, donos de playlists e tokens OAuth |
| `SERVIDOR`             | Representa uma guild do Discord com configurações próprias        |
| `CONTA_INTEGRACAO`     | Armazena credenciais OAuth de provedores externos (Spotify)       |
| `SESSAO_VOZ`           | Modela uma sessão ativa do bot em um canal de voz                 |
| `FILA` / `ITEM_FILA`   | Fila volátil de reprodução vinculada a uma sessão                 |
| `FAIXA`                | Entidade canônica de música, agnóstica de fonte                   |
| `FONTE`                | Referência à origem externa (YouTube, Spotify, SoundCloud)        |
| `PLAYLIST`             | Coleção persistente, podendo espelhar provedores externos         |
| `HISTORICO_REPRODUCAO` | Registro de auditoria e fonte primária para agregações estatísticas |
| `ESTATISTICA_*`        | Views materializadas para consultas analíticas de baixa latência  |

### Diagrama Entidade-Relacionamento (DER) — visão lógica

```mermaid
flowchart LR
    U[USUARIO]
    S[SERVIDOR]
    CI[CONTA_INTEGRACAO]
    SV[SESSAO_VOZ]
    F[FILA]
    IF[ITEM_FILA]
    FX[FAIXA]
    FO[FONTE]
    PL[PLAYLIST]
    PI[PLAYLIST_ITEM]
    HR[HISTORICO_REPRODUCAO]
    ES[ESTATISTICA_SERVIDOR]
    EU[ESTATISTICA_USUARIO]

    U -->|1:N inicia| SV
    U -->|1:N possui| PL
    U -->|1:N vincula| CI
    U -->|1:N ouve| HR
    U -->|1:N acumula| EU

    S -->|1:N hospeda| SV
    S -->|1:1 agrega| ES
    S -->|1:N contextualiza| EU

    SV -->|1:1 tem| F
    SV -->|1:N registra| HR

    F -->|1:N contem| IF
    FX -->|N:1 referenciada| IF
    FX -->|N:1 aparece| PI
    FX -->|N:1 tocada| HR
    FO -->|1:N origem| FX

    PL -->|1:N contem| PI
```

---

## Deploy em produção

### Oracle Cloud Infrastructure (Always Free)

A camada **Always Free** do Oracle Cloud oferece, sem prazo de expiração, até **4 vCPUs ARM Ampere A1 e 24 GB de RAM** distribuíveis em uma ou mais VMs, além de 200 GB de armazenamento em bloco e 10 TB de tráfego de saída mensal. O perfil de carga do bot — processo único de longa duração com pico de CPU apenas durante o transcoding via FFmpeg — opera com folga significativa nesse envelope de recursos.

Roteiro resumido:

1. Provisionar uma VM `VM.Standard.A1.Flex` (Ampere ARM) com Ubuntu 22.04 ou Oracle Linux
2. Configurar regras de ingress no Security List (apenas SSH é necessário para o bot)
3. Instalar Docker e Docker Compose na instância
4. Carregar as variáveis de ambiente via arquivo `.env`
5. Executar o container com política `restart=always` para resiliência a reboots
6. Opcional: configurar Watchtower para atualização automática da imagem

### Alternativas

Caso o Oracle Cloud não seja viável por região ou disponibilidade de quota ARM, alternativas equivalentes:

- **Google Cloud Free Tier**: instância `e2-micro` em regiões dos EUA, perpetuamente gratuita
- **AWS EC2 Free Tier**: `t2.micro` com 750 horas mensais durante os primeiros 12 meses
- **Fly.io**: camada gratuita compatível com containers Docker, com limites de recurso

---

## Roadmap

- [ ] Refatoração para arquitetura modular (services + adapters)
- [ ] Fila persistente de músicas (`~queue`, `~skip`, `~clear`)
- [ ] Visualizer com progress bar via edição de embed
- [ ] Autoplay com fallback para playlist ativa
- [ ] Retry policy resiliente no `yt-dlp`
- [ ] Integração Spotify via OAuth 2.0
- [ ] Importação de playlists do YouTube e Spotify
- [ ] Dashboard de estatísticas agregadas por servidor e usuário
- [ ] Dockerfile multi-stage com `docker-compose` (Postgres + Redis)
- [ ] Deploy automatizado no Oracle Cloud com systemd e Watchtower

---

## Contribuindo

Este é um projeto de portfólio pessoal, mas contribuições são bem-vindas. Diretrizes mínimas:

- Nunca versione arquivos de configuração com segredos (use `.env.example`)
- Mantenha mensagens de commit descritivas e atômicas
- Abra uma issue antes de propor mudanças estruturais significativas

---

## Licença

Distribuído sob a licença ISC. Consulte o arquivo `LICENSE` para detalhes.

---

Desenvolvido por [Daniel Furtado](https://github.com/).
