import { StreamType } from '@discordjs/voice';

export function buildPlaybackConfig() {
    return {
        ytdlpFormat: 'bestaudio[ext=webm][acodec=opus]/bestaudio',
        ytdlpExtractorArgs: 'youtube:player_client=android',
        streamType: StreamType.WebmOpus,
    };
}
