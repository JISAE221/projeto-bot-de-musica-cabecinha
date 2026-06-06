const ytdlp = require('yt-dlp-exec');

const URL_TESTE = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

console.log('=== TESTE YT-DLP STREAM ===');
console.log('URL:', URL_TESTE);
console.log('');

const processo = ytdlp.exec(URL_TESTE, {
    output: '-',
    format: 'bestaudio',
    quiet: false,
});

let totalBytes = 0;
let chunks = 0;

processo.stdout.on('data', chunk => {
    chunks++;
    totalBytes += chunk.length;
    process.stdout.write(
        `\r[STREAM] chunk #${chunks} | ${chunk.length}B | total: ${totalBytes}B | hex[0-8]: ${chunk.slice(0, 8).toString('hex')}`
    );
});

processo.stdout.on('end', () => {
    console.log(`\n\n[OK] Stream encerrado`);
    console.log(`  chunks recebidos : ${chunks}`);
    console.log(`  total de bytes   : ${totalBytes}`);
    console.log(`  aprox. MB        : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
});

processo.stderr.on('data', d => {
    console.log('[yt-dlp]', d.toString().trim());
});

processo.on('error', err => {
    console.error('\n[ERRO] processo falhou:', err.message);
});

processo.on('close', code => {
    if (code !== 0) console.error(`\n[ERRO] yt-dlp saiu com codigo ${code}`);
});
