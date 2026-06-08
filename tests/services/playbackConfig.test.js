import { describe, it, expect } from 'vitest';
import { StreamType } from '@discordjs/voice';
import { buildPlaybackConfig } from '../../src/services/playbackConfig.js';

describe('buildPlaybackConfig', () => {
    it('pede o formato webm/opus por padrão pra evitar transcode do ffmpeg', () => {
        const config = buildPlaybackConfig();

        expect(config.ytdlpFormat).toMatch(/bestaudio\[ext=webm\]\[acodec=opus\]/);
    });

    it('inclui fallback genérico no format pra cobrir vídeos sem trilha webm/opus', () => {
        const config = buildPlaybackConfig();

        expect(config.ytdlpFormat).toMatch(/\/bestaudio$/);
    });

    it('declara streamType WebmOpus pra que o discord receba opus nativo, sem ffmpeg no meio', () => {
        const config = buildPlaybackConfig();

        expect(config.streamType).toBe(StreamType.WebmOpus);
    });
});
