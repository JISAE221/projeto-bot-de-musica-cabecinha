import { EventEmitter } from 'node:events';

export class NetworkWatcher extends EventEmitter {
    constructor({
        targets,
        intervalMs = 10000,
        timeoutMs = 5000,
        degradedThresholdMs = 800,
        fetcher = globalThis.fetch,
        clock = Date,
    } = {}) {
        super();
        if (!targets || Object.keys(targets).length === 0) {
            throw new Error('NetworkWatcher precisa de pelo menos um target');
        }
        this.targets = targets;
        this.intervalMs = intervalMs;
        this.timeoutMs = timeoutMs;
        this.degradedThresholdMs = degradedThresholdMs;
        this.fetcher = fetcher;
        this.clock = clock;
        this.timerId = null;
    }

    async checkOnce() {
        const entradas = Object.entries(this.targets);
        const resultados = await Promise.all(
            entradas.map(([nome, url]) => this._mediar(nome, url))
        );
        const agregado = Object.fromEntries(resultados.map(r => [r.nome, r.dados]));

        for (const [nome, dados] of Object.entries(agregado)) {
            if (dados.ok && dados.latencyMs > this.degradedThresholdMs) {
                this.emit('degraded', { target: nome, latencyMs: dados.latencyMs });
            }
        }

        return agregado;
    }

    async _mediar(nome, url) {
        const inicio = this.clock.now();
        try {
            await this._comTimeout(this.fetcher(url, { method: 'HEAD' }));
            const latencyMs = this.clock.now() - inicio;
            return { nome, dados: { ok: true, latencyMs } };
        } catch (err) {
            return { nome, dados: { ok: false, error: err.message || String(err) } };
        }
    }

    _comTimeout(promessa) {
        return new Promise((resolve, reject) => {
            const tid = setTimeout(() => reject(new Error('timeout')), this.timeoutMs);
            promessa.then(
                v => { clearTimeout(tid); resolve(v); },
                e => { clearTimeout(tid); reject(e); }
            );
        });
    }

    start() {
        if (this.timerId) return;
        const rodar = async () => {
            try {
                const resultado = await this.checkOnce();
                this.emit('check', resultado);
            } catch (err) {
                this.emit('error', err);
            }
        };
        rodar();
        this.timerId = setInterval(rodar, this.intervalMs);
    }

    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}
