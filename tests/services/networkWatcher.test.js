import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkWatcher } from '../../src/services/networkWatcher.js';

describe('NetworkWatcher', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('checkOnce()', () => {
        it('retorna ok:true e latencyMs quando o alvo responde', async () => {
            const fetcher = vi.fn().mockResolvedValue({ ok: true });
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                timeoutMs: 5000,
                fetcher,
            });

            const resultado = await watcher.checkOnce();

            expect(resultado.youtube.ok).toBe(true);
            expect(typeof resultado.youtube.latencyMs).toBe('number');
            expect(resultado.youtube.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it('retorna ok:false e error quando o fetcher rejeita', async () => {
            const fetcher = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                timeoutMs: 5000,
                fetcher,
            });

            const resultado = await watcher.checkOnce();

            expect(resultado.youtube.ok).toBe(false);
            expect(resultado.youtube.error).toContain('ECONNRESET');
        });

        it('retorna ok:false com error timeout quando o fetcher demora mais que timeoutMs', async () => {
            const fetcher = vi.fn(() => new Promise(() => {}));
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                timeoutMs: 100,
                fetcher,
            });

            const promessa = watcher.checkOnce();
            await vi.advanceTimersByTimeAsync(150);
            const resultado = await promessa;

            expect(resultado.youtube.ok).toBe(false);
            expect(resultado.youtube.error).toMatch(/timeout/i);
        });

        it('checa múltiplos alvos em paralelo', async () => {
            const fetcher = vi.fn().mockResolvedValue({ ok: true });
            const watcher = new NetworkWatcher({
                targets: {
                    youtube: 'https://www.youtube.com',
                    discord: 'https://discord.com',
                },
                timeoutMs: 5000,
                fetcher,
            });

            const resultado = await watcher.checkOnce();

            expect(resultado.youtube.ok).toBe(true);
            expect(resultado.discord.ok).toBe(true);
            expect(fetcher).toHaveBeenCalledTimes(2);
        });
    });

    describe('start() / stop()', () => {
        it('start dispara checks periódicos no intervalo configurado', async () => {
            const fetcher = vi.fn().mockResolvedValue({ ok: true });
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                intervalMs: 1000,
                timeoutMs: 500,
                fetcher,
            });

            watcher.start();
            await vi.advanceTimersByTimeAsync(3500);
            watcher.stop();

            expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(3);
        });

        it('stop para os checks futuros', async () => {
            const fetcher = vi.fn().mockResolvedValue({ ok: true });
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                intervalMs: 1000,
                timeoutMs: 500,
                fetcher,
            });

            watcher.start();
            await vi.advanceTimersByTimeAsync(1500);
            const chamadasAntes = fetcher.mock.calls.length;
            watcher.stop();
            await vi.advanceTimersByTimeAsync(5000);

            expect(fetcher.mock.calls.length).toBe(chamadasAntes);
        });
    });

    describe('eventos', () => {
        it('emite check após cada rodada de medição', async () => {
            const fetcher = vi.fn().mockResolvedValue({ ok: true });
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                intervalMs: 1000,
                timeoutMs: 500,
                fetcher,
            });

            const handler = vi.fn();
            watcher.on('check', handler);
            watcher.start();
            await vi.advanceTimersByTimeAsync(2500);
            watcher.stop();

            expect(handler).toHaveBeenCalled();
            const payload = handler.mock.calls[0][0];
            expect(payload).toHaveProperty('youtube');
        });

        it('emite degraded quando a latência ultrapassa o threshold', async () => {
            const delay = 500;
            const fetcher = vi.fn(() =>
                new Promise(resolve => setTimeout(() => resolve({ ok: true }), delay))
            );
            const watcher = new NetworkWatcher({
                targets: { youtube: 'https://www.youtube.com' },
                intervalMs: 1000,
                timeoutMs: 5000,
                degradedThresholdMs: 200,
                fetcher,
            });

            const handler = vi.fn();
            watcher.on('degraded', handler);

            const promessa = watcher.checkOnce();
            await vi.advanceTimersByTimeAsync(600);
            await promessa;

            expect(handler).toHaveBeenCalled();
            const payload = handler.mock.calls[0][0];
            expect(payload.target).toBe('youtube');
            expect(payload.latencyMs).toBeGreaterThan(200);
        });
    });
});
