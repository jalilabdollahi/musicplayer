import { SyncedLyricLine } from '../types/music';

/**
 * Robust LRC Parser supporting:
 * [mm:ss.xx] or [mm:ss.xxx]
 * [offset:+/-ms]
 * ID tags [ti:...], [ar:...], [al:...]
 */
export function parseLrc(lrcText: string): { lyrics: SyncedLyricLine[]; metadata: Record<string, string> } {
  const lines = lrcText.split(/\r?\n/);
  const result: SyncedLyricLine[] = [];
  const metadata: Record<string, string> = {};
  let offsetMs = 0;

  // Regex to match timestamp tag: [01:23.45] or [01:23.456] or [01:23]
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const metaRegex = /^\[([a-zA-Z]+):(.*)\]$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is purely metadata tag
    const metaMatch = trimmed.match(metaRegex);
    if (metaMatch && !timeRegex.test(trimmed)) {
      const tag = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      metadata[tag] = value;
      if (tag === 'offset') {
        const parsedOffset = parseInt(value, 10);
        if (!isNaN(parsedOffset)) {
          offsetMs = parsedOffset;
        }
      }
      continue;
    }

    // Line might have one or more timestamps followed by text:
    // e.g. [00:12.00]Hello world or [00:12.00][00:24.00]Chorus
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const frac = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) / 100 : parseInt(match[3], 10) / 1000) : 0;
      const totalSeconds = minutes * 60 + seconds + frac;
      timestamps.push(totalSeconds);
      lastIndex = timeRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      const text = trimmed.substring(lastIndex).trim();
      for (const time of timestamps) {
        const adjustedTime = Math.max(0, time + offsetMs / 1000);
        result.push({
          id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
          time: adjustedTime,
          text: text || '♪',
        });
      }
    }
  }

  // Sort chronologically by time
  result.sort((a, b) => a.time - b.time);

  return { lyrics: result, metadata };
}

/**
 * Format seconds to [mm:ss.xx]
 */
export function formatLrcTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

/**
 * Serialize SyncedLyricLine array back to .lrc text string
 */
export function serializeToLrc(lyrics: SyncedLyricLine[], title?: string, artist?: string): string {
  const out: string[] = [];
  if (title) out.push(`[ti:${title}]`);
  if (artist) out.push(`[ar:${artist}]`);
  out.push(`[re:HighFi Player]`);
  out.push('');

  for (const line of lyrics) {
    out.push(`${formatLrcTime(line.time)} ${line.text}`);
  }

  return out.join('\n');
}

/**
 * Binary search to find current active lyric line index for a given playback time
 */
export function getActiveLyricIndex(lyrics: SyncedLyricLine[], currentTime: number): number {
  if (!lyrics || lyrics.length === 0) return -1;
  if (currentTime < lyrics[0].time) return -1;

  let low = 0;
  let high = lyrics.length - 1;
  let ans = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lyrics[mid].time <= currentTime) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return ans;
}
