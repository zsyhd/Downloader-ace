import type { AnalyzeResponse, SongErrorCode, SongMetadata } from '../src/shared/types.ts';
import { extractSongFromHtml, type ParsedSongPage } from './parser.ts';
import {
  detectAudioMagicFormat,
  isAllowedMediaRedirectHost,
  parseAndValidateAceSongUrl,
  sanitizeDownloadFilename,
} from './validation.ts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 150 * 1024 * 1024;
export const MAX_COVER_BYTES = 10 * 1024 * 1024;

interface CacheEntry {
  song: SongMetadata;
  expiresAt: number;
}

const songCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 1000;

export function clearSongCacheForUrl(normalizedUrl: string): void {
  songCache.delete(normalizedUrl);
}

export async function fetchWithSafeRedirects(
  targetUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<{ response: Response; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 15000;
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const parsed = new URL(currentUrl);
    if (!isAllowedMediaRedirectHost(parsed.hostname)) {
      throw new Error(`DISALLOWED_HOST:${parsed.hostname}`);
    }

    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { response, finalUrl: currentUrl };
      }
      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') {
        throw new Error(`DISALLOWED_PROTOCOL:${nextUrl.protocol}`);
      }
      if (!isAllowedMediaRedirectHost(nextUrl.hostname)) {
        throw new Error(`DISALLOWED_REDIRECT_HOST:${nextUrl.hostname}`);
      }
      currentUrl = nextUrl.toString();
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('TOO_MANY_REDIRECTS');
}

function parseTotalBytesFromHeaders(headers: Headers): number | null {
  const contentRange = headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)\s*$/);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const contentLength = headers.get('content-length');
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function readFirstBytes(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const combined = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = combined.length - offset;
    if (remaining <= 0) break;
    const slice = chunk.subarray(0, remaining);
    combined.set(slice, offset);
    offset += slice.byteLength;
  }
  return combined;
}

export interface AudioProbeOutcome {
  ok: boolean;
  errorCode?: SongErrorCode;
  message?: string;
  details?: string;
  format?: SongMetadata['audioFormat'];
  mimeType?: string;
  extension?: string;
  fileSizeBytes?: number | null;
}

export async function probeAudioUrl(audioUrl: string, refererUrl: string): Promise<AudioProbeOutcome> {
  try {
    const { response } = await fetchWithSafeRedirects(audioUrl, {
      headers: {
        Range: 'bytes=0-127',
        Referer: refererUrl,
        Accept: 'audio/*,*/*;q=0.8',
      },
      timeoutMs: 15000,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        errorCode: 'AUTH_OR_SUBSCRIPTION_REQUIRED',
        message: 'فایل صوتی نیازمند مجوز یا اشتراک است.',
        details: `سرور هنگام بررسی فایل صوتی وضعیت دسترسی ${response.status} برگرداند.`,
      };
    }

    if (response.status === 404 || response.status === 410) {
      return {
        ok: false,
        errorCode: 'NO_PUBLIC_AUDIO',
        message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
        details: `فایل صوتی در مسیر استخراج‌شده یافت نشد (HTTP ${response.status}).`,
      };
    }

    if (!response.ok && response.status !== 206) {
      return {
        ok: false,
        errorCode: 'SERVER_UNREACHABLE',
        message: 'سرور پاسخ نمی‌دهد.',
        details: `پاسخ غیرمنتظره از سرور صوتی دریافت شد (HTTP ${response.status}).`,
      };
    }

    const firstBytes = await readFirstBytes(response.body, 128);
    const contentType = response.headers.get('content-type');
    const totalBytes = parseTotalBytesFromHeaders(response.headers);

    if (totalBytes !== null && totalBytes > MAX_AUDIO_BYTES) {
      return {
        ok: false,
        errorCode: 'NO_PUBLIC_AUDIO',
        message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
        details: 'حجم فایل از حد مجاز فراتر است.',
      };
    }

    if (totalBytes !== null && totalBytes < 512) {
      return {
        ok: false,
        errorCode: 'NO_PUBLIC_AUDIO',
        message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
        details: 'فایل دریافتی بسیار کوچک یا خالی است.',
      };
    }

    const magic = detectAudioMagicFormat(firstBytes, contentType);
    if (!magic.valid) {
      return {
        ok: false,
        errorCode: 'NO_PUBLIC_AUDIO',
        message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
        details: magic.reason || 'محتوای فایل معتبر نیست یا به صفحه HTML اشاره دارد.',
      };
    }

    return {
      ok: true,
      format: magic.format,
      mimeType: magic.mimeType,
      extension: magic.extension,
      fileSizeBytes: totalBytes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('DISALLOWED_')) {
      return {
        ok: false,
        errorCode: 'NO_PUBLIC_AUDIO',
        message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
        details: 'مسیر تغییرمسیر فایل صوتی در دامنه مجاز نیست.',
      };
    }
    return {
      ok: false,
      errorCode: 'SERVER_UNREACHABLE',
      message: 'سرور پاسخ نمی‌دهد.',
      details: 'ارتباط با سرور میزبان فایل صوتی برقرار نشد یا زمان انتظار به پایان رسید.',
    };
  }
}

function buildPartialSongMetadata(
  parsed: ParsedSongPage,
  normalizedUrl: string,
  shareToken: string | null
): Partial<SongMetadata> {
  return {
    songId: parsed.songId,
    shareToken,
    normalizedUrl,
    title: parsed.title || `آهنگ ${parsed.songId}`,
    creator: parsed.creator,
    coverUrl: parsed.coverUrl,
    durationText: parsed.durationText,
    durationSeconds: parsed.durationSeconds,
    publishedDate: parsed.publishedDate,
    styleTags: parsed.styleTags,
    modelKey: parsed.modelKey,
    modelName: parsed.modelName,
    state: parsed.state,
    visibility: parsed.visibility,
    availableFormats: parsed.availableFormats,
    freeFormats: parsed.freeFormats,
    isPaidOwner: parsed.isPaidOwner,
    lyrics: parsed.lyrics,
    extractionSources: parsed.extractionSources,
  };
}

export async function analyzeAceSongUrl(
  rawUrl: string,
  options: { bypassCache?: boolean } = {}
): Promise<AnalyzeResponse> {
  const validated = parseAndValidateAceSongUrl(rawUrl);
  if (!validated.valid) {
    return {
      ok: false,
      errorCode: validated.errorCode,
      message: validated.message,
      details: validated.details,
    };
  }

  const { normalizedUrl, songId, shareToken } = validated;
  if (!options.bypassCache) {
    const cached = songCache.get(normalizedUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ok: true,
        song: cached.song,
        corsNote:
          'سایت acemusic.ai هدر CORS را برای درخواست‌های مستقیم مرورگر باز نگذاشته است؛ بررسی متادیتا و انتقال فایل صوتی به‌صورت امن از طریق سرور برنامه انجام شد.',
      };
    }
  }

  let htmlResponse: Response;
  let finalPageUrl: string;
  try {
    const fetched = await fetchWithSafeRedirects(normalizedUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeoutMs: 15000,
    });
    htmlResponse = fetched.response;
    finalPageUrl = fetched.finalUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('DISALLOWED_')) {
      return {
        ok: false,
        errorCode: 'INVALID_URL',
        message: 'لینک نامعتبر است.',
        details: 'تغییر مسیر لینک به دامنه غیرمجاز مسدود شد.',
      };
    }
    return {
      ok: false,
      errorCode: 'SERVER_UNREACHABLE',
      message: 'سرور پاسخ نمی‌دهد.',
      details: 'امکان برقراری ارتباط با acemusic.ai وجود ندارد یا زمان پاسخ‌گویی به پایان رسید.',
    };
  }

  if (htmlResponse.status === 404 || htmlResponse.status === 410) {
    return {
      ok: false,
      errorCode: 'SONG_NOT_FOUND',
      message: 'آهنگ پیدا نشد.',
      details: `صفحه‌ای برای شناسه ${songId} در acemusic.ai یافت نشد (HTTP ${htmlResponse.status}).`,
    };
  }

  if (htmlResponse.status === 401 || htmlResponse.status === 403) {
    return {
      ok: false,
      errorCode: 'AUTH_OR_SUBSCRIPTION_REQUIRED',
      message: 'فایل صوتی نیازمند مجوز یا اشتراک است.',
      details: `دسترسی به صفحه این آهنگ محدود شده است (HTTP ${htmlResponse.status}).`,
    };
  }

  if (!htmlResponse.ok) {
    return {
      ok: false,
      errorCode: 'SERVER_UNREACHABLE',
      message: 'سرور پاسخ نمی‌دهد.',
      details: `سایت acemusic.ai خطای HTTP ${htmlResponse.status} برگرداند.`,
    };
  }

  const contentType = (htmlResponse.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return {
      ok: false,
      errorCode: 'SONG_NOT_FOUND',
      message: 'آهنگ پیدا نشد.',
      details: 'پاسخ دریافتی از آدرس یک صفحه وب معتبر نیست.',
    };
  }

  const html = await htmlResponse.text();
  if (html.length > MAX_HTML_BYTES) {
    return {
      ok: false,
      errorCode: 'SERVER_UNREACHABLE',
      message: 'سرور پاسخ نمی‌دهد.',
      details: 'حجم صفحه دریافتی بیش از حد مجاز است.',
    };
  }

  const parsed = extractSongFromHtml(html, finalPageUrl, songId);
  const partialSong = buildPartialSongMetadata(parsed, normalizedUrl, shareToken);

  if (parsed.state === 'making') {
    return {
      ok: false,
      errorCode: 'NO_PUBLIC_AUDIO',
      message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
      details: 'این آهنگ هنوز در حال ساخت روی سرور ACE Music است و فایل نهایی آماده نشده است.',
      song: partialSong,
    };
  }

  if (parsed.state === 'failed') {
    return {
      ok: false,
      errorCode: 'NO_PUBLIC_AUDIO',
      message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
      details: 'ساخت این آهنگ در ACE Music ناموفق بوده و فایل صوتی ندارد.',
      song: partialSong,
    };
  }

  if (!parsed.audioUrl) {
    if (parsed.requiresSubscription) {
      return {
        ok: false,
        errorCode: 'AUTH_OR_SUBSCRIPTION_REQUIRED',
        message: 'فایل صوتی نیازمند مجوز یا اشتراک است.',
        details: `مدل ${parsed.modelName} یا تنظیمات این آهنگ امکان دانلود عمومی بدون اشتراک/ورود را فعال نکرده است.`,
        song: partialSong,
      };
    }

    if (!parsed.title && parsed.extractionSources.length === 0) {
      return {
        ok: false,
        errorCode: 'SONG_NOT_FOUND',
        message: 'آهنگ پیدا نشد.',
        details: 'اطلاعات آهنگ در صفحه یافت نشد یا لینک منقضی شده است.',
      };
    }

    return {
      ok: false,
      errorCode: 'NO_PUBLIC_AUDIO',
      message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
      details: 'در کد HTML، تگ <audio>، Open Graph یا JSON-LD هیچ لینک صوتی عمومی وجود نداشت.',
      song: partialSong,
    };
  }

  // Probe the extracted audio URL to confirm it returns real binary audio (not HTML or 403)
  const probe = await probeAudioUrl(parsed.audioUrl, normalizedUrl);
  if (!probe.ok || !probe.format || !probe.extension) {
    return {
      ok: false,
      errorCode: probe.errorCode || 'NO_PUBLIC_AUDIO',
      message: probe.message || 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
      details: probe.details || 'اعتبارسنجی باینری فایل صوتی ناموفق بود.',
      song: partialSong,
    };
  }

  const title = parsed.title || `آهنگ ${parsed.songId}`;
  const { utf8Filename } = sanitizeDownloadFilename(title, parsed.songId, probe.extension);

  const song: SongMetadata = {
    songId: parsed.songId,
    shareToken,
    normalizedUrl,
    title,
    creator: parsed.creator,
    coverUrl: parsed.coverUrl,
    durationText: parsed.durationText,
    durationSeconds: parsed.durationSeconds,
    publishedDate: parsed.publishedDate,
    styleTags: parsed.styleTags,
    modelKey: parsed.modelKey,
    modelName: parsed.modelName,
    state: parsed.state,
    visibility: parsed.visibility,
    availableFormats: parsed.availableFormats,
    freeFormats: parsed.freeFormats,
    isPaidOwner: parsed.isPaidOwner,
    audioUrl: parsed.audioUrl,
    audioFormat: probe.format,
    audioMimeType: probe.mimeType || 'audio/mpeg',
    audioExtension: probe.extension,
    fileSizeBytes: probe.fileSizeBytes ?? null,
    downloadable: true,
    downloadFilename: utf8Filename,
    lyrics: parsed.lyrics,
    extractionSources: parsed.extractionSources,
  };

  // Prune cache if large
  if (songCache.size >= 100) {
    const oldestKey = songCache.keys().next().value;
    if (oldestKey) songCache.delete(oldestKey);
  }
  songCache.set(normalizedUrl, {
    song,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return {
    ok: true,
    song,
    corsNote:
      'سایت acemusic.ai هدر CORS را برای درخواست‌های مستقیم مرورگر باز نگذاشته است؛ بررسی متادیتا و انتقال فایل صوتی به‌صورت امن از طریق سرور برنامه انجام شد.',
  };
}
