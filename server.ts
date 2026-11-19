import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  analyzeAceSongUrl,
  clearSongCacheForUrl,
  fetchWithSafeRedirects,
  MAX_AUDIO_BYTES,
  MAX_COVER_BYTES,
} from './server/fetcher.ts';
import { embedId3v2Tags } from './server/id3.ts';
import { detectAudioMagicFormat, sanitizeDownloadFilename } from './server/validation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ace-music-downloader' });
  });

  // 1. Analyze Song endpoint
  app.post('/api/analyze', async (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const result = await analyzeAceSongUrl(rawUrl);
    if (result.ok) {
      return res.json(result);
    }

    const statusMap: Record<string, number> = {
      INVALID_URL: 400,
      SONG_NOT_FOUND: 404,
      AUTH_OR_SUBSCRIPTION_REQUIRED: 403,
      NO_PUBLIC_AUDIO: 422,
      CORS_BLOCKED: 422,
      SERVER_UNREACHABLE: 502,
      DOWNLOAD_INCOMPLETE: 502,
    };
    return res.status(statusMap[result.errorCode] || 400).json(result);
  });

  // 2. Real Audio Download endpoint (only serves verified acemusic.ai song URLs)
  app.get('/api/download', async (req, res) => {
    const songUrl = typeof req.query.songUrl === 'string' ? req.query.songUrl : '';
    let analysis = await analyzeAceSongUrl(songUrl);

    if (!analysis.ok) {
      return res.status(422).json(analysis);
    }

    const song = analysis.song;
    if (!song.audioUrl || !song.downloadable) {
      return res.status(422).json({
        ok: false,
        errorCode: 'NO_PUBLIC_AUDIO',
        message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
        details: 'فایل صوتی قابل دانلود برای این آهنگ در دسترس نیست.',
      });
    }

    try {
      let { response } = await fetchWithSafeRedirects(song.audioUrl, {
        headers: {
          Referer: song.normalizedUrl,
          Accept: 'audio/*,*/*;q=0.8',
        },
        timeoutMs: 60000,
      });

      // If cached signed URL expired, refresh once
      if (response.status === 403) {
        clearSongCacheForUrl(song.normalizedUrl);
        analysis = await analyzeAceSongUrl(songUrl, { bypassCache: true });
        if (!analysis.ok || !analysis.song.audioUrl) {
          return res.status(403).json({
            ok: false,
            errorCode: 'AUTH_OR_SUBSCRIPTION_REQUIRED',
            message: 'فایل صوتی نیازمند مجوز یا اشتراک است.',
            details: 'لینک صوتی منقضی شده یا دسترسی به آن محدود است.',
          });
        }
        const retried = await fetchWithSafeRedirects(analysis.song.audioUrl, {
          headers: {
            Referer: analysis.song.normalizedUrl,
            Accept: 'audio/*,*/*;q=0.8',
          },
          timeoutMs: 60000,
        });
        response = retried.response;
      }

      if (!response.ok || !response.body) {
        return res.status(502).json({
          ok: false,
          errorCode: 'DOWNLOAD_INCOMPLETE',
          message: 'دانلود ناقص یا ناموفق بوده است.',
          details: `سرور هنگام دریافت فایل وضعیت HTTP ${response.status} برگرداند.`,
        });
      }

      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
      if (contentLength !== null && contentLength > MAX_AUDIO_BYTES) {
        await response.body.cancel().catch(() => {});
        return res.status(413).json({
          ok: false,
          errorCode: 'DOWNLOAD_INCOMPLETE',
          message: 'دانلود ناقص یا ناموفق بوده است.',
          details: 'حجم فایل صوتی بیش از حد مجاز سرور است.',
        });
      }

      const reader = response.body.getReader();
      const firstRead = await reader.read();
      if (firstRead.done || !firstRead.value || firstRead.value.byteLength === 0) {
        return res.status(502).json({
          ok: false,
          errorCode: 'DOWNLOAD_INCOMPLETE',
          message: 'دانلود ناقص یا ناموفق بوده است.',
          details: 'پاسخ صوتی از سرور خالی دریافت شد.',
        });
      }

      const upstreamContentType = response.headers.get('content-type');
      const magic = detectAudioMagicFormat(firstRead.value, upstreamContentType);
      if (!magic.valid) {
        await reader.cancel().catch(() => {});
        return res.status(422).json({
          ok: false,
          errorCode: 'NO_PUBLIC_AUDIO',
          message: 'صفحه در دسترس است ولی فایل صوتی عمومی پیدا نشد.',
          details: magic.reason || 'فایل دریافتی معتبر نیست.',
        });
      }

      const { utf8Filename, asciiFallback } = sanitizeDownloadFilename(
        song.title,
        song.songId,
        magic.extension || song.audioExtension
      );

      res.setHeader('Content-Type', magic.mimeType || song.audioMimeType || 'audio/mpeg');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Audio-Format', magic.format);
      res.setHeader('Cache-Control', 'no-store');

      let clientAborted = false;
      req.on('close', () => {
        clientAborted = true;
        reader.cancel().catch(() => {});
      });

      const MAX_TAGGABLE_MP3_BYTES = 50 * 1024 * 1024;
      const shouldEmbedId3 =
        magic.format === 'mp3' &&
        (contentLength === null || contentLength <= MAX_TAGGABLE_MP3_BYTES);

      if (shouldEmbedId3) {
        const audioChunks: Buffer[] = [Buffer.from(firstRead.value)];
        let totalRead = firstRead.value.byteLength;
        let exceededLimit = false;

        while (!clientAborted) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            totalRead += value.byteLength;
            if (totalRead > MAX_TAGGABLE_MP3_BYTES) {
              exceededLimit = true;
              // Flush buffered chunks and stream remaining bytes without ID3 buffering
              if (contentLength && Number.isFinite(contentLength)) {
                res.setHeader('Content-Length', String(contentLength));
              }
              for (const c of audioChunks) {
                if (!res.write(c)) {
                  await new Promise<void>((resolve) => res.once('drain', resolve));
                }
              }
              if (!res.write(Buffer.from(value))) {
                await new Promise<void>((resolve) => res.once('drain', resolve));
              }
              break;
            }
            audioChunks.push(Buffer.from(value));
          }
        }

        if (exceededLimit) {
          while (!clientAborted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
              const canContinue = res.write(Buffer.from(value));
              if (!canContinue) {
                await new Promise<void>((resolve) => res.once('drain', resolve));
              }
            }
          }
          if (!clientAborted) res.end();
          return;
        }

        if (clientAborted) return;

        const rawAudioBuffer = Buffer.concat(audioChunks);
        let coverInput: { bytes: Uint8Array; mimeType: string } | null = null;
        if (song.coverUrl) {
          try {
            const coverRes = await fetchCoverWithFallback(song.coverUrl, song.normalizedUrl, 8000);
            if (coverRes && coverRes.ok) {
              const coverCt = (coverRes.headers.get('content-type') || '')
                .split(';')[0]
                .trim()
                .toLowerCase();
              if (coverCt.startsWith('image/')) {
                const coverBuf = new Uint8Array(await coverRes.arrayBuffer());
                if (coverBuf.byteLength > 0 && coverBuf.byteLength <= MAX_COVER_BYTES) {
                  coverInput = { bytes: coverBuf, mimeType: coverCt };
                }
              }
            }
          } catch {
            // Cover embed is best-effort; continue tagging metadata without cover
          }
        }

        if (clientAborted) return;

        const lyricsText =
          song.lyrics.length > 0
            ? song.lyrics
                .map((sec) =>
                  sec.heading ? `[${sec.heading}]\n${sec.lines.join('\n')}` : sec.lines.join('\n')
                )
                .join('\n\n')
            : null;

        const taggedAudio = embedId3v2Tags(rawAudioBuffer, {
          title: song.title,
          artist: song.creator,
          album: 'ACE Music',
          lyricsText,
          cover: coverInput,
        });

        res.setHeader('Content-Length', String(taggedAudio.byteLength));
        res.setHeader('X-Id3-Tagged', coverInput ? 'full' : 'metadata');
        res.end(Buffer.from(taggedAudio));
        return;
      }

      if (contentLength && Number.isFinite(contentLength)) {
        res.setHeader('Content-Length', String(contentLength));
      }

      res.write(Buffer.from(firstRead.value));

      while (!clientAborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      }

      if (!clientAborted) {
        res.end();
      }
    } catch {
      if (!res.headersSent) {
        return res.status(502).json({
          ok: false,
          errorCode: 'DOWNLOAD_INCOMPLETE',
          message: 'دانلود ناقص یا ناموفق بوده است.',
          details: 'ارتباط هنگام انتقال فایل صوتی قطع شد.',
        });
      }
      res.end();
    }
  });

  // 3. Stream endpoint for HTML5 <audio> player (supports Range requests for seeking)
  app.get('/api/stream', async (req, res) => {
    const songUrl = typeof req.query.songUrl === 'string' ? req.query.songUrl : '';
    const analysis = await analyzeAceSongUrl(songUrl);
    if (!analysis.ok || !analysis.song.audioUrl) {
      return res.status(404).end();
    }

    const song = analysis.song;
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;

    try {
      const { response } = await fetchWithSafeRedirects(song.audioUrl!, {
        headers: {
          Referer: song.normalizedUrl,
          Accept: 'audio/*,*/*;q=0.8',
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
        timeoutMs: 30000,
      });

      if (!response.ok && response.status !== 206) {
        return res.status(response.status).end();
      }

      const contentType = response.headers.get('content-type') || song.audioMimeType || 'audio/mpeg';
      if (contentType.toLowerCase().includes('text/html')) {
        return res.status(422).end();
      }

      res.status(response.status);
      res.setHeader('Content-Type', contentType);
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      const contentRange = response.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      res.setHeader('Cache-Control', 'private, max-age=120');

      if (!response.body) {
        return res.end();
      }

      const reader = response.body.getReader();
      let closed = false;
      req.on('close', () => {
        closed = true;
        reader.cancel().catch(() => {});
      });

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          const ok = res.write(Buffer.from(value));
          if (!ok) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      }
      if (!closed) res.end();
    } catch {
      if (!res.headersSent) res.status(502).end();
      else res.end();
    }
  });

  // 4. Safe Cover Image endpoint (only serves extracted cover from validated acemusic.ai song)
  app.get('/api/cover', async (req, res) => {
    const songUrl = typeof req.query.songUrl === 'string' ? req.query.songUrl : '';
    const analysis = await analyzeAceSongUrl(songUrl);
    if (!analysis.ok || !analysis.song.coverUrl) {
      return res.status(404).end();
    }

    try {
      const response = await fetchCoverWithFallback(
        analysis.song.coverUrl,
        analysis.song.normalizedUrl,
        15000
      );

      if (!response || !response.ok) return res.status(404).end();

      const ct = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!ct.startsWith('image/')) return res.status(415).end();

      const contentLength = Number(response.headers.get('content-length') || '0');
      if (contentLength > MAX_COVER_BYTES) return res.status(413).end();

      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return res.status(404).end();

      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=300');

      if (req.query.download === '1') {
        const extMap: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/gif': 'gif',
        };
        const ext = extMap[ct] || 'jpg';
        const { utf8Filename, asciiFallback } = sanitizeDownloadFilename(
          `${analysis.song.title}-cover`,
          analysis.song.songId,
          ext
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`
        );
      }

      return res.send(buf);
    } catch {
      return res.status(502).end();
    }
  });

  if (!IS_PROD) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        ...(hmrDisabled ? { hmr: false } : {}),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ACE Music Downloader running on http://0.0.0.0:${PORT}`);
  });
}

async function fetchCoverWithFallback(
  coverUrl: string,
  refererUrl: string,
  timeoutMs: number
): Promise<Response | null> {
  const headers = {
    Referer: refererUrl,
    Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8',
  };
  const { response } = await fetchWithSafeRedirects(coverUrl, { headers, timeoutMs });
  if (response.ok) return response;

  try {
    const parsed = new URL(coverUrl);
    if (parsed.search) {
      const cleanUrl = `${parsed.origin}${parsed.pathname}`;
      const retried = await fetchWithSafeRedirects(cleanUrl, { headers, timeoutMs });
      if (retried.response.ok) return retried.response;
    }
  } catch {
    // Ignore malformed URL fallback
  }
  return response;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
