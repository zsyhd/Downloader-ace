import type { LyricsSection } from '../shared/types.ts';

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function getNextPlaybackSpeed(current: number): number {
  const idx = PLAYBACK_SPEEDS.findIndex((s) => Math.abs(s - current) < 0.01);
  if (idx === -1) return 1;
  return PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
}

export function formatPlaybackSpeed(speed: number): string {
  return `${speed}×`;
}

export function parseStyleTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[,،;؛]/)) {
    const clean = part.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(clean);
  }
  return tags;
}

export function formatLyricsText(
  title: string,
  creator: string | null | undefined,
  lyrics: LyricsSection[]
): string {
  const body = lyrics
    .map((sec) => (sec.heading ? `[${sec.heading}]\n${sec.lines.join('\n')}` : sec.lines.join('\n')))
    .join('\n\n');

  if (!body.trim()) return '';
  const headerLines = [title.trim()];
  if (creator?.trim()) {
    headerLines.push(`سازنده: ${creator.trim()}`);
  }
  return `${headerLines.join('\n')}\n\n${body}`;
}
