import * as cheerio from 'cheerio';
import type { AceModelKey, AudioFormat, LyricsSection } from '../src/shared/types.ts';

export interface ParsedSongPage {
  songId: string;
  title: string | null;
  creator: string | null;
  coverUrl: string | null;
  durationText: string | null;
  durationSeconds: number | null;
  publishedDate: string | null;
  styleTags: string | null;
  modelKey: AceModelKey;
  modelName: string;
  state: 'ready' | 'making' | 'failed' | 'unknown';
  visibility: string | null;
  availableFormats: string[];
  freeFormats: string[];
  isPaidOwner: boolean;
  audioUrl: string | null;
  audioTypeHint: string | null;
  inferredFormat: AudioFormat;
  requiresSubscription: boolean;
  lyrics: LyricsSection[];
  extractionSources: string[];
}

export function resolveAceUrl(rawUrl: string | null | undefined, baseUrl: string): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  try {
    const resolved = new URL(rawUrl.trim(), baseUrl);
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

export function parseDurationToSeconds(durationText: string | null | undefined): number | null {
  if (!durationText) return null;
  const trimmed = durationText.trim();
  // Match mm:ss or hh:mm:ss
  const clockMatch = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clockMatch) {
    const hours = clockMatch[1] ? Number(clockMatch[1]) : 0;
    const mins = Number(clockMatch[2]);
    const secs = Number(clockMatch[3]);
    if (Number.isFinite(hours) && Number.isFinite(mins) && Number.isFinite(secs)) {
      return hours * 3600 + mins * 60 + secs;
    }
  }
  // Match ISO 8601 duration PT2M12S
  const isoMatch = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3])) {
    const h = Number(isoMatch[1] || 0);
    const m = Number(isoMatch[2] || 0);
    const s = Math.round(Number(isoMatch[3] || 0));
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function formatSecondsToClock(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function normalizeModelInfo(rawKey: string | null | undefined, rawText: string | null | undefined): {
  modelKey: AceModelKey;
  modelName: string;
} {
  const combined = `${rawKey || ''} ${rawText || ''}`.toLowerCase();

  if (combined.includes('1.5') || combined.includes('ace-step')) {
    return {
      modelKey: 'ace-step-1.5-xl',
      modelName: rawText?.trim() || 'ACE-Step v1.5 XL',
    };
  }
  if (combined.includes('1.1') || combined.includes('preview')) {
    return {
      modelKey: 'ace-music-v1.1-preview',
      modelName: rawText?.trim() || 'ACE Music v1.1 Preview',
    };
  }
  if (combined.includes('v1') || combined.includes('ace-music-1')) {
    return {
      modelKey: 'ace-music-v1',
      modelName: rawText?.trim() || 'ACE Music v1',
    };
  }
  return {
    modelKey: 'other',
    modelName: rawText?.trim() || rawKey?.trim() || 'نامشخص',
  };
}

export function inferAudioFormatFromUrlOrMime(audioUrl: string | null, mimeType: string | null): AudioFormat {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';

  if (audioUrl) {
    const cleanPath = audioUrl.split('?')[0].toLowerCase();
    if (cleanPath.endsWith('.mp3')) return 'mp3';
    if (cleanPath.endsWith('.wav')) return 'wav';
    if (cleanPath.endsWith('.flac')) return 'flac';
    if (cleanPath.endsWith('.ogg')) return 'ogg';
    if (cleanPath.endsWith('.m4a') || cleanPath.endsWith('.aac')) return 'm4a';
  }
  return 'unknown';
}

function cleanOgTitle(rawTitle: string | null | undefined): { title: string | null; creator: string | null } {
  if (!rawTitle) return { title: null, creator: null };
  const stripped = rawTitle.replace(/\s*\|\s*ACE Music\s*$/i, '').trim();
  const byIndex = stripped.lastIndexOf(' by ');
  if (byIndex > 0) {
    return {
      title: stripped.slice(0, byIndex).trim() || null,
      creator: stripped.slice(byIndex + 4).trim() || null,
    };
  }
  return { title: stripped || null, creator: null };
}

export function extractSongFromHtml(html: string, sourceUrl: string, fallbackSongId: string): ParsedSongPage {
  const $ = cheerio.load(html);
  const extractionSources: string[] = [];

  // 1. Inspect <main class="song-page"> dataset attributes
  const songMain = $('main.song-page').first();
  const hasSongPage = songMain.length > 0;
  if (hasSongPage) extractionSources.push('DOM (song-page)');

  const slugAttr = songMain.attr('data-slug')?.trim() || fallbackSongId;
  const stateAttr = songMain.attr('data-state')?.trim().toLowerCase();
  const state: ParsedSongPage['state'] =
    stateAttr === 'ready' || stateAttr === 'making' || stateAttr === 'failed' ? stateAttr : 'unknown';

  const dataTitle = songMain.attr('data-title')?.trim() || null;
  const dataBy = songMain.attr('data-by')?.trim() || null;
  const dataCover = songMain.attr('data-cover')?.trim() || null;
  const dataPaid = songMain.attr('data-paid')?.trim().toLowerCase() === 'true';
  const dataVisibility = songMain.attr('data-visibility')?.trim() || null;
  const dataFormats = (songMain.attr('data-formats') || '')
    .split(/\s+/)
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  const dataFree = (songMain.attr('data-free') || '')
    .split(/\s+/)
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  const dataModel = songMain.attr('data-model')?.trim() || null;

  // 2. Inspect HTML5 <audio> elements
  const audioEl = $('audio').first();
  const audioSrcAttr =
    audioEl.attr('src')?.trim() || audioEl.find('source').first().attr('src')?.trim() || null;
  const audioSourceType = audioEl.find('source').first().attr('type')?.trim() || null;
  if (audioSrcAttr) extractionSources.push('HTML5 <audio>');

  // 3. Inspect Open Graph metadata
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || null;
  const ogAudio =
    $('meta[property="og:audio"]').attr('content')?.trim() ||
    $('meta[property="og:audio:secure_url"]').attr('content')?.trim() ||
    null;
  const ogAudioType = $('meta[property="og:audio:type"]').attr('content')?.trim() || null;
  if (ogTitle || ogAudio || ogImage) extractionSources.push('Open Graph');

  // 4. Inspect JSON-LD scripts
  let ldTitle: string | null = null;
  let ldCreator: string | null = null;
  let ldImage: string | null = null;
  let ldAudioUrl: string | null = null;
  let ldAudioEncoding: string | null = null;
  let ldDurationSec: number | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const rawJson = $(el).text().trim();
    if (!rawJson) return;
    try {
      const parsed = JSON.parse(rawJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const typeStr = String(item['@type'] || '').toLowerCase();
        if (typeStr.includes('music') || typeStr.includes('audio') || item.audio || item.contentUrl) {
          extractionSources.push('JSON-LD');
          if (typeof item.name === 'string' && !ldTitle) ldTitle = item.name.trim();
          if (typeof item.byArtist?.name === 'string' && !ldCreator) ldCreator = item.byArtist.name.trim();
          if (typeof item.author?.name === 'string' && !ldCreator) ldCreator = item.author.name.trim();
          if (typeof item.image === 'string' && !ldImage) ldImage = item.image.trim();
          if (typeof item.duration === 'string' && ldDurationSec === null) {
            ldDurationSec = parseDurationToSeconds(item.duration);
          }
          if (typeof item.contentUrl === 'string' && !ldAudioUrl) ldAudioUrl = item.contentUrl.trim();
          if (typeof item.audio === 'string' && !ldAudioUrl) ldAudioUrl = item.audio.trim();
          if (item.audio && typeof item.audio === 'object') {
            if (typeof item.audio.contentUrl === 'string' && !ldAudioUrl) {
              ldAudioUrl = item.audio.contentUrl.trim();
            }
            if (typeof item.audio.encodingFormat === 'string' && !ldAudioEncoding) {
              ldAudioEncoding = item.audio.encodingFormat.trim();
            }
          }
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks
    }
  });

  // 5. Inspect visible song page DOM fields
  const h1Title = songMain.find('.sp-title h1').first().text().trim() || $('h1').first().text().trim() || null;
  const modelText = songMain.find('.sp-model').first().text().trim() || null;
  const durTextDom = songMain.find('.sp-dur').first().text().trim() || null;
  const spMetaText = songMain.find('.sp-meta').first().text().trim() || '';
  const styleTextDom = songMain.find('.sp-style').first().text().trim() || null;
  const domCover = songMain.find('.sp-art img').first().attr('src')?.trim() || null;

  // Parse .sp-meta ("creator · 2:12 · Nov 17, 2026")
  let metaCreator: string | null = null;
  let metaDurationText: string | null = null;
  let publishedDate: string | null = null;
  if (spMetaText) {
    const parts = spMetaText
      .split('·')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0 && !/^\d+:\d{2}$/.test(parts[0])) {
      metaCreator = parts[0];
    }
    for (const part of parts) {
      if (/^(?:\d+:)?\d{1,2}:\d{2}$/.test(part) && !metaDurationText) {
        metaDurationText = part;
      } else if (/[A-Za-z]{3}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}/.test(part)) {
        publishedDate = part;
      }
    }
  }

  // Extract lyrics sections if visible
  const lyrics: LyricsSection[] = [];
  songMain.find('.sp-lyrics .sp-sec').each((_, secEl) => {
    const heading = $(secEl).find('h3').first().text().trim() || '';
    const pHtml = $(secEl).find('p').first().html() || '';
    const lines = pHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      lyrics.push({ heading, lines });
    }
  });

  // Resolve OG title/creator fallback
  const parsedOg = cleanOgTitle(ogTitle);
  const pageTitleTag = cleanOgTitle($('title').first().text().trim());

  const title = dataTitle || h1Title || ldTitle || parsedOg.title || pageTitleTag.title || null;
  const creator = dataBy || metaCreator || ldCreator || parsedOg.creator || pageTitleTag.creator || null;

  const durationSeconds =
    parseDurationToSeconds(durTextDom) ?? parseDurationToSeconds(metaDurationText) ?? ldDurationSec;
  const durationText = durTextDom || metaDurationText || formatSecondsToClock(durationSeconds);

  let styleTags = styleTextDom;
  if (!styleTags && ogDescription) {
    const descMatch = ogDescription.match(/^A song made with ACE Music\s*[—–-]\s*(.+)$/i);
    if (descMatch) {
      styleTags = descMatch[1].trim();
    }
  }

  const coverUrl = resolveAceUrl(dataCover || domCover || ogImage || ldImage, sourceUrl);
  const rawAudioCandidate = audioSrcAttr || ogAudio || ldAudioUrl;
  const audioUrl = resolveAceUrl(rawAudioCandidate, sourceUrl);
  const audioTypeHint = audioSourceType || ogAudioType || ldAudioEncoding || null;
  const inferredFormat = inferAudioFormatFromUrlOrMime(audioUrl, audioTypeHint);

  const { modelKey, modelName } = normalizeModelInfo(dataModel, modelText);

  // Determine whether subscription/authorization blocks public download
  const pageTextLower = $('body').text().toLowerCase();
  const hasPaywallHint =
    (hasSongPage && !dataPaid && dataFormats.length > 0 && dataFree.length === 0 && !audioUrl) ||
    dataVisibility === 'private' ||
    (!audioUrl &&
      (pageTextLower.includes('upgrade to download') ||
        pageTextLower.includes('subscription required') ||
        pageTextLower.includes('subscribe to download')));

  return {
    songId: slugAttr,
    title,
    creator,
    coverUrl,
    durationText,
    durationSeconds,
    publishedDate,
    styleTags,
    modelKey,
    modelName,
    state,
    visibility: dataVisibility,
    availableFormats: dataFormats,
    freeFormats: dataFree,
    isPaidOwner: dataPaid,
    audioUrl,
    audioTypeHint,
    inferredFormat,
    requiresSubscription: hasPaywallHint,
    lyrics,
    extractionSources: Array.from(new Set(extractionSources)),
  };
}
