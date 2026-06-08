import 'dotenv/config';
import ffmpegPath from 'ffmpeg-static';
process.env.FFMPEG_PATH = ffmpegPath;

import { Client, GatewayIntentBits } from 'discord.js';
import ytdlp from 'yt-dlp-exec';
import * as portavoz from '@discordjs/voice';
import { NetworkWatcher } from './src/services/networkWatcher.js';
import { buildPlaybackConfig } from './src/services/playbackConfig.js';

if (!process.env.DISCORD_TOKEN) {
    console.error('cadê o DISCORD_TOKEN no .env caralho, sem isso eu nem subo');
    process.exit(1);
}

const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ]
});

const watcher = new NetworkWatcher({
    targets: {
        youtube: 'https://www.youtube.com',
        ytcdn:   'https://i.ytimg.com',
        discord: 'https://discord.com/api/v10/gateway',
    },
    intervalMs: 15000,
    timeoutMs: 5000,
    degradedThresholdMs: 800,
});

watcher.on('check', resultado => {
    const partes = Object.entries(resultado).map(([nome, dados]) =>
        dados.ok ? `${nome}=${dados.latencyMs}ms` : `${nome}=ERR(${dados.error})`
    );
    console.log(`[NET] ${partes.join(' | ')}`);
});

watcher.on('degraded', ({ target, latencyMs }) => {
    console.warn(`[NET][DEGRADED] ${target} respondeu em ${latencyMs}ms (acima do threshold)`);
});

let player = null;
let connection = null;

bot.login(process.env.DISCORD_TOKEN);
bot.on('clientReady', () => {
    console.log('TO FUNCIONANDO BCT');
    watcher.start();
});

bot.on('messageCreate', async msg => {
    if (msg.author.bot) return;

    const content = msg.content.toLowerCase().trim();

    if (content.startsWith('~play')) {
        if (!msg.member.voice.channelId)
            return msg.channel.send('ENTRA NUM CANAL DE VOZ PRIMEIRO seu animal');

        const url = msg.content.split(' ')[1];
        if (!url)
            return msg.channel.send('mano cadê a URL?? que eu vou tocar, o silêncio??');

        if (!/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url))
            return msg.channel.send('isso aqui não é link do youtube não bicho, que trem torto é esse');

        const canal = msg.member.voice.channel;
        const perms = canal.permissionsFor(msg.guild.members.me);

        if (!perms.has('Connect') || !perms.has('Speak'))
            return msg.channel.send('não tenho permissão nesse canal cara, pede pro admin me liberar Connect e Speak');

        const t0 = Date.now();
        const marco = etapa => console.log(`[PLAY][t+${Date.now() - t0}ms] ${etapa}`);

        marco('~play recebido — capturando snapshot de rede');
        const snapshot = await watcher.checkOnce();
        const snapStr = Object.entries(snapshot).map(([n, d]) =>
            d.ok ? `${n}=${d.latencyMs}ms` : `${n}=ERR`
        ).join(' | ');
        marco(`snapshot: ${snapStr}`);

        try {
            connection = portavoz.joinVoiceChannel({
                channelId: canal.id,
                guildId: msg.guild.id,
                adapterCreator: msg.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });
            marco('joinVoiceChannel chamado');

            player = portavoz.createAudioPlayer({
                behaviors: { noSubscriber: portavoz.NoSubscriberBehavior.Play }
            });

            player.on('error', err => {
                console.error('[PLAYER ERRO]', err.message);
                msg.channel.send('DEU RUIM no player, tenta outra URL');
            });

            player.on(portavoz.AudioPlayerStatus.Playing, () => {
                marco('AudioPlayerStatus.Playing — áudio começou de verdade');
            });

            player.on(portavoz.AudioPlayerStatus.Idle, () =>
                msg.channel.send('acabou a música mano... bota mais uma ou eu fico aqui olhando pra vocês')
            );

            connection.subscribe(player);

            const tocar = () => {
                const { ytdlpFormat, ytdlpExtractorArgs, streamType } = buildPlaybackConfig();
                marco(`voice connection READY — spawnando yt-dlp (format=${ytdlpFormat}, extractorArgs=${ytdlpExtractorArgs})`);
                const processo = ytdlp.exec(url, {
                    output: '-',
                    format: ytdlpFormat,
                    extractorArgs: ytdlpExtractorArgs,
                    quiet: true,
                });
                marco('yt-dlp spawnado');

                processo.on('error', err => {
                    console.error('[ERRO yt-dlp]', err.message);
                    msg.channel.send('DEU RUIM no yt-dlp cara, tenta outra URL');
                });

                processo.stdout.once('data', () => marco('primeiro byte do yt-dlp recebido'));

                const resource = portavoz.createAudioResource(processo.stdout, {
                    inputType: streamType,
                });
                marco(`AudioResource criado (streamType=${streamType})`);

                player.play(resource);
                marco('player.play() chamado');
                msg.channel.send('JA TA TOCANDO PAPAI 🎵');
            };

            if (connection.state.status === portavoz.VoiceConnectionStatus.Ready) {
                tocar();
            } else {
                let tocou = false;
                connection.on('stateChange', (_, novo) => {
                    if (novo.status === portavoz.VoiceConnectionStatus.Ready && !tocou) {
                        tocou = true;
                        tocar();
                    }
                });
            }

        } catch (err) {
            console.error('[ERRO geral]', err);
            msg.channel.send('TRAVOU TUDO, nem eu sei o que aconteceu. tenta de novo');
        }
    }

    else if (content === '~stop') {
        if (!player) return msg.channel.send('para o quê mano, não tem nada tocando aqui não');
        player.stop();
        msg.channel.send('parei papai. feliz agora?');
    }

    else if (content === '~pause') {
        if (!player) return msg.channel.send('pausar o quê exatamente, o silêncio??');
        player.pause();
        msg.channel.send('pausei papai, pode ir no banheiro tranquilo 🚽');
    }

    else if (content === '~resume' || content === '~continua') {
        if (!player) return msg.channel.send('continuar o quê cara, não tem nada aqui');
        player.unpause();
        msg.channel.send('voltou papai, bem-vindo de volta ao canal 🎵');
    }

    else if (content === '~disconnect' || content === '~dc') {
        if (!msg.member.voice.channel)
            return msg.channel.send('ENTRA EM ALGUM CANAL primeiro, pelo amor');

        if (msg.member.voice.channel.id === '773039700800831508')
            return msg.channel.send('Ventilador de Ferro BiTURBO');

        if (!connection)
            return msg.channel.send('eu nem tô conectado em canal nenhum bicho');

        if (msg.member.voice.channel.id !== msg.guild.members.me.voice.channelId)
            return msg.channel.send('Você precisa estar conectado no mesmo canal que eu, otário!');

        player?.stop();
        connection.disconnect();
        connection = null;
        player = null;
        msg.channel.send('fui embora papai, tchau 👋');
    }

    else if (content === '~help' || content === '~ajuda') {
        msg.channel.send(
            '**oque eu sei fazer (por enquanto):**\n' +
            '`~play <url>` — toca música do youtube\n' +
            '`~stop` — para tudo\n' +
            '`~pause` — pausa\n' +
            '`~resume` — continua\n' +
            '`~disconnect` — me manda embora\n\n' +
            'só isso mesmo, não sou o spotify não véi'
        );
    }
});
