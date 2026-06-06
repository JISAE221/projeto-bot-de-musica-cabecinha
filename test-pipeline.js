// testa cada camada do pipeline de audio sem Discord
// roda com: node test-pipeline.js <url>

process.env.FFMPEG_PATH = require('ffmpeg-static');

const ytdlp = require('yt-dlp-exec');
const portavoz = require('@discordjs/voice');
const { Readable } = require('stream');

const URL = process.argv[2] || 'https://youtu.be/ChJWcL57cp8';

console.log('=== TDD PIPELINE DE AUDIO ===\n');

// CAMADA 1: yt-dlp stream
console.log('[1/3] testando yt-dlp stream...');
const proc = ytdlp.exec(URL, {
    output: '-',
    format: 'bestaudio[ext=webm]/bestaudio',
    quiet: true,
});

let bytes = 0;
let chunks = 0;
const streamOK = new Promise((resolve, reject) => {
    proc.stdout.on('data', chunk => {
        chunks++;
        bytes += chunk.length;
        if (chunks === 1) {
            const hex = chunk.slice(0, 4).toString('hex');
            const isEBML = hex === '1a45dfa3';
            console.log(`  primeiro chunk: ${chunk.length}B | hex: ${hex} | EBML header: ${isEBML ? 'SIM ✓' : 'NAO ✗'}`);
        }
    });
    proc.stdout.on('end', () => {
        console.log(`  total: ${chunks} chunks | ${bytes}B | ${(bytes/1024/1024).toFixed(2)}MB`);
        console.log('  [1/3] STREAM OK ✓\n');
        resolve({ chunks, bytes });
    });
    proc.on('error', err => {
        console.error('  [1/3] FALHOU ✗:', err.message);
        reject(err);
    });
});

streamOK.then(() => {
    // CAMADA 2: audio resource com StreamType.WebmOpus
    console.log('[2/3] testando createAudioResource (WebmOpus)...');
    const proc2 = ytdlp.exec(URL, {
        output: '-',
        format: 'bestaudio[ext=webm]/bestaudio',
        quiet: true,
    });

    try {
        const resource = portavoz.createAudioResource(proc2.stdout, {
            inputType: portavoz.StreamType.WebmOpus,
        });
        console.log('  resource criado:', resource.playbackDuration !== undefined ? 'OK ✓' : 'SEM DURACAO ✗');
        console.log('  inputType:', resource.audioPlayer ? 'subscribed' : 'nao subscribed (normal aqui)');

        const player = portavoz.createAudioPlayer();

        let estadosPlayer = [];
        player.on('stateChange', (old, novo) => {
            estadosPlayer.push(`${old.status} -> ${novo.status}`);
            console.log(`  [player] ${old.status} -> ${novo.status}`);
        });

        player.on('error', err => {
            console.error('  [player ERRO] ✗:', err.message);
        });

        player.play(resource);
        console.log('  player.play() chamado com WebmOpus');

        setTimeout(() => {
            console.log(`  estados do player: [${estadosPlayer.join(', ')}]`);
            if (estadosPlayer.some(e => e.includes('playing'))) {
                console.log('  [2/3] WEBMOPUS OK ✓\n');
            } else {
                console.log('  [2/3] WEBMOPUS NAO CHEGOU EM PLAYING - tentando Arbitrary...\n');
                testarArbitrary();
            }
            player.stop();
            proc2.kill?.();
        }, 4000);

    } catch (err) {
        console.error('  [2/3] FALHOU ✗:', err.message);
        testarArbitrary();
    }
}).catch(() => {});

function testarArbitrary() {
    console.log('[3/3] testando createAudioResource (Arbitrary/FFmpeg)...');
    const proc3 = ytdlp.exec(URL, {
        output: '-',
        format: 'bestaudio[ext=webm]/bestaudio',
        quiet: true,
    });

    try {
        const resource = portavoz.createAudioResource(proc3.stdout, {
            inputType: portavoz.StreamType.Arbitrary,
        });

        const player = portavoz.createAudioPlayer();
        let estadosPlayer = [];

        player.on('stateChange', (old, novo) => {
            estadosPlayer.push(`${old.status} -> ${novo.status}`);
            console.log(`  [player] ${old.status} -> ${novo.status}`);
        });

        player.on('error', err => {
            console.error('  [player ERRO] ✗:', err.message);
        });

        player.play(resource);
        console.log('  player.play() chamado com Arbitrary');

        setTimeout(() => {
            console.log(`  estados do player: [${estadosPlayer.join(', ')}]`);
            if (estadosPlayer.some(e => e.includes('playing'))) {
                console.log('  [3/3] ARBITRARY OK ✓');
                console.log('\n=== RESULTADO: usa StreamType.Arbitrary no bot ===');
            } else {
                console.log('  [3/3] ARBITRARY TAMBEM NAO CHEGOU EM PLAYING ✗');
                console.log('\n=== RESULTADO: problema nas permissoes do Discord ===');
            }
            player.stop();
            proc3.kill?.();
            process.exit(0);
        }, 5000);

    } catch (err) {
        console.error('  [3/3] FALHOU ✗:', err.message);
        process.exit(1);
    }
}
