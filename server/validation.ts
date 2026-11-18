import type { AudioFormat } from '../src/shared/types.ts';

export const ALLOWED_PAGE_HOSTS = new Set(['acemusic.ai', 'www.acemusic.ai']);

const SONG_PATH_REGEX = /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?song\/([A-Za-z0-9_-]{4,64})\/?$/i;
const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{4,128}$/;

export interface ValidatedSongUrl {
  valid: true;
  normalizedUrl: string;
  songId: string;
  shareToken: string | null;
}

export interface InvalidSongUrl {
  valid: false;
  errorCode: 'INVALID_URL';
  message: string;
  details: string;
}

export function parseAndValidateAceSongUrl(rawInput: string): ValidatedSongUrl | InvalidSongUrl {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      message: 'لینک نامعتبر است.',
      details: 'لطفاً لینک اشتراک‌گذاری آهنگ از سایت acemusic.ai را وارد کنید.',
    };
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^(?:www\.)?acemusic\.ai\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return {
        valid: false,
        errorCode: 'INVALID_URL',
        message: 'لینک نامعتبر است.',
        details: 'آدرس باید با https://acemusic.ai/song/... شروع شود.',
      };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      message: 'لینک نامعتبر است.',
      details: 'ساختار آدرس اینترنتی معتبر نیست.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      message: 'لینک نامعتبر است.',
      details: 'فقط پروتکل HTTP/HTTPS پشتیبانی می‌شود.',
    };
  }

  if (parsed.username || parsed.password || parsed.port) {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      message: 'لینک نامعتبر است.',
      details: 'آدرس نباید شامل نام کاربری، رمز عبور یا پورت سفارشی باشد.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_PAGE_HOSTS.has(hostname)) {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      message: 'لینک نامعتبر است.',
      details: 'فقط لینک‌های دامنه رسمی acemusic.ai پشتیبانی می‌شوند.',
    };
  }

  const pathMatch = parsed.pathname.match(SONG_PATH_REGEX);
  if (!pathMatch) {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      message: 'لینک نامعتبر است.',
      details: 'مسیر لینک باید مطابق الگوی https://acemusic.ai/song/{songId}?sh={shareToken} باشد.',
    };
  }

  const songId = pathMatch[1];
  const rawSh = parsed.searchParams.get('sh');
  let shareToken: string | null = null;
  if (rawSh !== null && rawSh.trim() !== '') {
    if (!SHARE_TOKEN_REGEX.test(rawSh.trim())) {
      return {
        valid: false,
        errorCode: 'INVALID_URL',
        message: 'لینک نامعتبر است.',
        details: 'پارامتر sh در لینک اشتراک‌گذاری فرمت معتبری ندارد.',
      };
    }
    shareToken = rawSh.trim();
  }

  // Always canonicalize to https://acemusic.ai and preserve sh token if present
  const canonical = new URL(`https://acemusic.ai${parsed.pathname.replace(/\/+$/, '')}`);
  if (shareToken) {
    canonical.searchParams.set('sh', shareToken);
  }

  return {
    valid: true,
    normalizedUrl: canonical.toString(),
    songId,
    shareToken,
  };
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 literal check
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  // IPv6 ULA / link-local
  if (host.includes(':')) {
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || host === '::') {
      return true;
    }
  }

  return false;
}

export function isAllowedMediaRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (isPrivateOrLoopbackHost(host)) return false;

  if (ALLOWED_PAGE_HOSTS.has(host) || host.endsWith('.acemusic.ai')) {
    return true;
  }

  // Official Cloudflare R2 storage hosts used by acemusic.ai signed audio/cover redirects
  if (host.endsWith('.r2.cloudflarestorage.com') || host.endsWith('.cloudflarestorage.com')) {
    return true;
  }

  return false;
}

export interface AudioMagicResult {
  valid: boolean;
  format: AudioFormat;
  mimeType: string;
  extension: string;
  reason?: string;
}

export function detectAudioMagicFormat(bytes: Uint8Array, contentTypeHeader?: string | null): AudioMagicResult {
  const ct = (contentTypeHeader || '').split(';')[0].trim().toLowerCase();

  if (bytes.length === 0) {
    return {
      valid: false,
      format: 'unknown',
      mimeType: ct || 'application/octet-stream',
      extension: '',
      reason: 'فایل دریافتی خالی است.',
    };
  }

  // Reject obvious HTML / JSON / XML payloads disguised as audio
  const asciiHead = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, 64)))
    .trimStart()
    .toLowerCase();

  if (
    asciiHead.startsWith('<!doctype') ||
    asciiHead.startsWith('<html') ||
    asciiHead.startsWith('<head') ||
    asciiHead.startsWith('<body') ||
    asciiHead.startsWith('<script') ||
    asciiHead.startsWith('<?xml') ||
    asciiHead.startsWith('{') ||
    ct.startsWith('text/html') ||
    ct.startsWith('application/json') ||
    ct.startsWith('text/plain')
  ) {
    return {
      valid: false,
      format: 'unknown',
      mimeType: ct || 'text/html',
      extension: '',
      reason: 'آدرس به جای فایل صوتی، صفحه وب یا پاسخ متنی برگرداند.',
    };
  }

  // Check ID3 tag (MP3)
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { valid: true, format: 'mp3', mimeType: 'audio/mpeg', extension: 'mp3' };
  }

  // Check MPEG ADTS/Frame sync (MP3): 11 bits of 1s (0xFFE0), layer != 00
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const layer = (bytes[1] >> 1) & 0x03;
    // MPEG audio layers 1,2,3 have layer !== 0; ADTS AAC has layer === 0
    if (layer !== 0 && ct !== 'audio/aac') {
      return { valid: true, format: 'mp3', mimeType: 'audio/mpeg', extension: 'mp3' };
    }
    return { valid: true, format: 'm4a', mimeType: 'audio/aac', extension: 'aac' };
  }

  // Check RIFF....WAVE (WAV)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return { valid: true, format: 'wav', mimeType: 'audio/wav', extension: 'wav' };
  }

  // Check fLaC
  if (bytes.length >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { valid: true, format: 'flac', mimeType: 'audio/flac', extension: 'flac' };
  }

  // Check OggS
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { valid: true, format: 'ogg', mimeType: 'audio/ogg', extension: 'ogg' };
  }

  // Check ISO BMFF (M4A / MP4 audio): ftyp at offset 4
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { valid: true, format: 'm4a', mimeType: 'audio/mp4', extension: 'm4a' };
  }

  // Fallback only if Content-Type explicitly says audio/*
  if (ct.startsWith('audio/')) {
    if (ct === 'audio/mpeg' || ct === 'audio/mp3') {
      return { valid: true, format: 'mp3', mimeType: 'audio/mpeg', extension: 'mp3' };
    }
    if (ct === 'audio/wav' || ct === 'audio/x-wav' || ct === 'audio/wave') {
      return { valid: true, format: 'wav', mimeType: 'audio/wav', extension: 'wav' };
    }
    if (ct === 'audio/flac' || ct === 'audio/x-flac') {
      return { valid: true, format: 'flac', mimeType: 'audio/flac', extension: 'flac' };
    }
    if (ct === 'audio/ogg') {
      return { valid: true, format: 'ogg', mimeType: 'audio/ogg', extension: 'ogg' };
    }
    if (ct === 'audio/mp4' || ct === 'audio/m4a' || ct === 'audio/x-m4a') {
      return { valid: true, format: 'm4a', mimeType: 'audio/mp4', extension: 'm4a' };
    }
  }

  return {
    valid: false,
    format: 'unknown',
    mimeType: ct || 'application/octet-stream',
    extension: '',
    reason: 'فرمت باینری فایل به عنوان صوت معتبر شناسایی نشد.',
  };
}

export function sanitizeDownloadFilename(
  title: string | null | undefined,
  songId: string,
  extension: string
): { utf8Filename: string; asciiFallback: string } {
  const safeExt = (extension || 'mp3').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp3';
  const cleanedTitle = (title || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  const baseName = cleanedTitle || `ace-music-${songId}`;
  const utf8Filename = `${baseName}.${safeExt}`;

  const asciiBase =
    baseName
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[^a-zA-Z0-9._ -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `ace-music-${songId}`;

  return {
    utf8Filename,
    asciiFallback: `${asciiBase}.${safeExt}`,
  };
}
