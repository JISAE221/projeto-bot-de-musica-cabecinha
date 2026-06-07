import { describe, it, expect } from 'vitest';

describe('sanity check do setup de testes', () => {
    it('o vitest tá vivo e a matemática não quebrou', () => {
        expect(1 + 1).toBe(2);
    });

    it('async funciona', async () => {
        const valor = await Promise.resolve('funcionou');
        expect(valor).toBe('funcionou');
    });
});
