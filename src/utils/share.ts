export function buildDirectDownloadUrl(origin: string, normalizedSongUrl: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/api/download?songUrl=${encodeURIComponent(normalizedSongUrl)}`;
}

export function getDirectAudioCopyUrl(
  audioUrl: string | null | undefined,
  origin: string,
  normalizedSongUrl: string
): string | null {
  const trimmedAudioUrl = typeof audioUrl === 'string' ? audioUrl.trim() : '';
  if (/^https?:\/\//i.test(trimmedAudioUrl)) {
    return trimmedAudioUrl;
  }
  if (normalizedSongUrl.trim() && origin.trim()) {
    return buildDirectDownloadUrl(origin, normalizedSongUrl);
  }
  return null;
}

export function canNavigatorShareFiles(
  nav: { share?: unknown; canShare?: (data?: ShareData) => boolean } | undefined,
  file: File
): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') {
    return false;
  }
  try {
    return Boolean(nav.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

export function supportsNativeAudioFileShare(
  nav: { share?: unknown; canShare?: (data?: ShareData) => boolean } | undefined =
    typeof navigator !== 'undefined' ? navigator : undefined
): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') {
    return false;
  }
  if (typeof File !== 'function') return false;
  try {
    const probe = new File([new Uint8Array(1)], 'probe.mp3', { type: 'audio/mpeg' });
    return Boolean(nav.canShare({ files: [probe] }));
  } catch {
    return false;
  }
}

export function canNavigatorShareUrl(
  nav: { share?: unknown; canShare?: (data?: ShareData) => boolean } | undefined,
  data: { title?: string; text?: string; url?: string }
): boolean {
  if (!nav || typeof nav.share !== 'function') {
    return false;
  }
  if (typeof nav.canShare === 'function') {
    try {
      return Boolean(nav.canShare(data));
    } catch {
      return false;
    }
  }
  return true;
}

export function normalizeAudioShareMimeType(
  contentType: string | null | undefined,
  audioFormat: string | null | undefined
): string {
  const base = (contentType || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp3' || base === 'audio/x-mpeg') return 'audio/mpeg';
  if (base.startsWith('audio/')) return base;
  switch ((audioFormat || '').toLowerCase()) {
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'audio/mpeg';
  }
}

export function getShareErrorKind(err: unknown): 'abort' | 'not-allowed' | 'other' {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name?: unknown }).name);
    if (name === 'AbortError') return 'abort';
    if (name === 'NotAllowedError') return 'not-allowed';
  }
  return 'other';
}
