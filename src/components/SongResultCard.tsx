import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  Music2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEffect, useRef, useState } from 'react';
import type { SongErrorCode, SongMetadata } from '../shared/types.ts';
import { formatAudioClock, formatBytes } from '../utils/formatters.ts';
import {
  canNavigatorShareFiles,
  canNavigatorShareUrl,
  getDirectAudioCopyUrl,
  getShareErrorKind,
} from '../utils/share.ts';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer.tsx';

interface SongResultCardProps {
  song: SongMetadata;
  onDownloadSuccess: () => void;
  onDownloadError: (code: SongErrorCode, message: string, details: string) => void;
}

function fireCosmicConfetti(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    void confetti({
      particleCount: 55,
      spread: 68,
      startVelocity: 32,
      ticks: 160,
      origin: { y: 0.72 },
      colors: ['#8B5CF6', '#6366F1', '#38BDF8', '#E0E7FF'],
      disableForReducedMotion: true,
    });
  } catch {
    // Ignore canvas unavailability
  }
}

async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function SongResultCard({
  song,
  onDownloadSuccess,
  onDownloadError,
}: SongResultCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const cachedAudioBlobRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const [coverFailed, setCoverFailed] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedUrlRecently, setCopiedUrlRecently] = useState(false);
  const [copiedDownloadUrlRecently, setCopiedDownloadUrlRecently] = useState(false);
  const [copiedLyricsRecently, setCopiedLyricsRecently] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'preparing' | 'ready-retry'>('idle');

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [duration, setDuration] = useState<number>(song.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Real download state
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalDownloadBytes, setTotalDownloadBytes] = useState<number | null>(song.fileSizeBytes);

  const streamUrl = `/api/stream?songUrl=${encodeURIComponent(song.normalizedUrl)}`;
  const coverProxyUrl = song.coverUrl
    ? `/api/cover?songUrl=${encodeURIComponent(song.normalizedUrl)}`
    : null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    setCoverFailed(false);
    setLyricsOpen(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setBufferedEnd(0);
    setDuration(song.durationSeconds || 0);
    setAudioError(null);
    setDownloadState('idle');
    setDownloadProgress(null);
    setDownloadedBytes(0);
    setTotalDownloadBytes(song.fileSizeBytes);
    setCopiedUrlRecently(false);
    setCopiedDownloadUrlRecently(false);
    setCopiedLyricsRecently(false);
    setShareState('idle');
    cachedAudioBlobRef.current = null;
  }, [song.normalizedUrl, song.durationSeconds, song.fileSizeBytes]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const ensureAudioAnalyser = async () => {
    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        sourceNodeRef.current = source;
        setAnalyserNode(analyser);
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch {
      // Fall back gracefully to standard HTMLAudioElement playback without analyser
    }
  };

  const handleCopyUrl = async () => {
    const ok = await writeTextToClipboard(song.normalizedUrl);
    if (ok) {
      setCopiedUrlRecently(true);
      showToast('کپی شد! لینک صفحه آهنگ در کلیپ‌بورد ذخیره گردید.');
      window.setTimeout(() => setCopiedUrlRecently(false), 2500);
    } else {
      showToast('مرورگر اجازه دسترسی به کلیپ‌بورد را نداد.');
    }
  };

  const handleCopyDownloadUrl = async () => {
    if (!song.downloadable || typeof window === 'undefined') return;
    const directUrl = getDirectAudioCopyUrl(
      song.audioUrl,
      window.location.origin,
      song.normalizedUrl
    );
    if (!directUrl) return;
    const ok = await writeTextToClipboard(directUrl);
    if (ok) {
      setCopiedDownloadUrlRecently(true);
      showToast('لینک مستقیم دانلود فایل صوتی در کلیپ‌بورد کپی شد!');
      window.setTimeout(() => setCopiedDownloadUrlRecently(false), 2500);
    } else {
      showToast('مرورگر اجازه دسترسی به کلیپ‌بورد را نداد.');
    }
  };

  const handleShareAudioFile = async () => {
    if (!song.downloadable || !song.audioUrl || shareState === 'preparing') return;

    const directShareUrl =
      getDirectAudioCopyUrl(
        song.audioUrl,
        typeof window !== 'undefined' ? window.location.origin : '',
        song.normalizedUrl
      ) || song.normalizedUrl;

    const triggerUrlShareOrSave = async (blob: Blob): Promise<boolean> => {
      const shareData = {
        title: song.title,
        text: `دانلود فایل صوتی ${song.title}`,
        url: directShareUrl,
      };
      if (canNavigatorShareUrl(navigator, shareData)) {
        try {
          await navigator.share(shareData);
          setShareState('idle');
          showToast('پنجره اشتراک‌گذاری باز شد!');
          return true;
        } catch (err) {
          const kind = getShareErrorKind(err);
          if (kind === 'abort') {
            setShareState('idle');
            return true;
          }
          if (kind === 'not-allowed') {
            setShareState('ready-retry');
            showToast('فایل آماده شد؛ یک بار دیگر روی «ارسال فایل آماده» بزنید.');
            return true;
          }
        }
      }
      triggerBrowserSave(blob, song.downloadFilename);
      setShareState('idle');
      showToast(
        'این مرورگر اشتراک‌گذاری مستقیم را پشتیبانی نمی‌کند؛ فایل ذخیره شد تا به تلگرام بفرستید.'
      );
      return false;
    };

    const triggerShareWithCached = async (blob: Blob, mimeType: string) => {
      const audioFile = new File([blob], song.downloadFilename, { type: mimeType });
      if (canNavigatorShareFiles(navigator, audioFile)) {
        try {
          await navigator.share({
            files: [audioFile],
            title: song.title,
          });
          setShareState('idle');
          showToast('فایل صوتی برای اشتراک‌گذاری ارسال شد!');
        } catch (err) {
          const kind = getShareErrorKind(err);
          if (kind === 'abort') {
            setShareState('idle');
            return;
          }
          if (kind === 'not-allowed') {
            setShareState('ready-retry');
            showToast('فایل آماده شد؛ یک بار دیگر روی «ارسال فایل آماده» بزنید.');
            return;
          }
          await triggerUrlShareOrSave(blob);
        }
      } else {
        await triggerUrlShareOrSave(blob);
      }
    };

    if (cachedAudioBlobRef.current) {
      await triggerShareWithCached(
        cachedAudioBlobRef.current.blob,
        cachedAudioBlobRef.current.mimeType
      );
      return;
    }

    setShareState('preparing');
    try {
      const response = await fetch(`/api/download?songUrl=${encodeURIComponent(song.normalizedUrl)}`);
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error('INVALID_CONTENT');
      }
      const blob = await response.blob();
      if (blob.size < 512) {
        throw new Error('EMPTY_BLOB');
      }
      const finalMime = contentType || song.audioMimeType || 'audio/mpeg';
      cachedAudioBlobRef.current = { blob, mimeType: finalMime };
      await triggerShareWithCached(blob, finalMime);
    } catch {
      setShareState('idle');
      showToast('دریافت فایل برای اشتراک‌گذاری با خطا مواجه شد.');
    }
  };

  const handleCopyLyrics = async () => {
    if (song.lyrics.length === 0) return;
    const text = song.lyrics
      .map((sec) => (sec.heading ? `[${sec.heading}]\n${sec.lines.join('\n')}` : sec.lines.join('\n')))
      .join('\n\n');
    const ok = await writeTextToClipboard(text);
    if (ok) {
      setCopiedLyricsRecently(true);
      showToast('متن آهنگ در کلیپ‌بورد کپی شد!');
      window.setTimeout(() => setCopiedLyricsRecently(false), 2500);
    }
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);

    if (audio.paused) {
      try {
        await ensureAudioAnalyser();
        await audio.play();
        setIsPlaying(true);
      } catch {
        setAudioError('پخش صوت در مرورگر با خطا مواجه شد.');
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    const maxBound = effectiveDuration > 0 ? effectiveDuration : value;
    const clamped = Math.max(0, Math.min(value, maxBound));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const handleSkipBy = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    handleSeek(audio.currentTime + deltaSeconds);
  };

  const updateBuffered = (audio: HTMLAudioElement) => {
    if (audio.buffered.length > 0) {
      setBufferedEnd(audio.buffered.end(audio.buffered.length - 1));
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const handleDownload = async () => {
    if (!song.downloadable || !song.audioUrl || downloadState === 'downloading') return;

    setDownloadState('downloading');
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalDownloadBytes(song.fileSizeBytes);

    try {
      const response = await fetch(`/api/download?songUrl=${encodeURIComponent(song.normalizedUrl)}`);

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        setDownloadState('idle');
        setDownloadProgress(null);
        onDownloadError(
          errBody?.errorCode || 'DOWNLOAD_INCOMPLETE',
          errBody?.message || 'دانلود ناقص یا ناموفق بوده است.',
          errBody?.details || `درخواست دانلود با وضعیت ${response.status} متوقف شد.`
        );
        return;
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        setDownloadState('idle');
        setDownloadProgress(null);
        onDownloadError(
          'DOWNLOAD_INCOMPLETE',
          'دانلود ناقص یا ناموفق بوده است.',
          'پاسخ سرور فایل صوتی معتبر نیست.'
        );
        return;
      }

      const headerLength = Number(response.headers.get('content-length') || '0');
      const expectedTotal = headerLength > 0 ? headerLength : song.fileSizeBytes;
      if (expectedTotal) setTotalDownloadBytes(expectedTotal);

      if (!response.body) {
        const blob = await response.blob();
        if (blob.size < 512) {
          throw new Error('EMPTY_BLOB');
        }
        const finalMime = contentType || song.audioMimeType || 'audio/mpeg';
        cachedAudioBlobRef.current = { blob, mimeType: finalMime };
        triggerBrowserSave(blob, song.downloadFilename);
        onDownloadSuccess();
        fireCosmicConfetti();
        setDownloadedBytes(blob.size);
        setDownloadProgress(100);
        setDownloadState('done');
        return;
      }

      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          chunks.push(new Uint8Array(value));
          received += value.byteLength;
          setDownloadedBytes(received);
          if (expectedTotal && expectedTotal > 0) {
            setDownloadProgress(Math.min(100, Math.round((received / expectedTotal) * 100)));
          } else {
            setDownloadProgress(null);
          }
        }
      }

      if (received < 512 || (headerLength > 0 && received < headerLength)) {
        throw new Error('INCOMPLETE_STREAM');
      }

      const finalMime = contentType || song.audioMimeType || 'audio/mpeg';
      const blob = new Blob(chunks, { type: finalMime });
      cachedAudioBlobRef.current = { blob, mimeType: finalMime };
      triggerBrowserSave(blob, song.downloadFilename);
      onDownloadSuccess();
      fireCosmicConfetti();

      setDownloadProgress(100);
      setDownloadState('done');
    } catch {
      setDownloadState('idle');
      setDownloadProgress(null);
      onDownloadError(
        'DOWNLOAD_INCOMPLETE',
        'دانلود ناقص یا ناموفق بوده است.',
        'انتقال فایل صوتی پیش از تکمیل متوقف شد. لطفاً دوباره تلاش کنید.'
      );
    }
  };

  const isMp3 = song.audioFormat === 'mp3';
  const formatUpper = song.audioFormat !== 'unknown' ? song.audioFormat.toUpperCase() : 'MP3';
  const downloadLabel = isMp3 ? 'دانلود MP3' : `دانلود ${formatUpper}`;
  const effectiveDuration = duration > 0 ? duration : song.durationSeconds || 0;
  const progressPct =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;
  const remainingSeconds = effectiveDuration > 0 ? Math.max(0, effectiveDuration - currentTime) : 0;

  return (
    <article
      aria-label={`نتیجه بررسی آهنگ ${song.title}`}
      className="relative rounded-2xl border border-indigo-300/15 bg-[#0B0D1D]/85 p-5 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgba(79,70,229,0.35)] sm:p-7"
    >
      {/* Temporary Copied! Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-400/35 bg-[#0A181A]/95 px-4 py-2.5 text-xs sm:text-sm font-medium text-emerald-200 shadow-lg backdrop-blur-md"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr] md:items-start">
        {/* Cover Art with guaranteed fallback */}
        <div className="mx-auto w-full max-w-[220px] md:mx-0">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-indigo-300/20 bg-[#050610]">
            {coverProxyUrl && !coverFailed ? (
              <img
                src={coverProxyUrl}
                alt={`تصویر جلد آهنگ ${song.title}`}
                referrerPolicy="no-referrer"
                onError={() => setCoverFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-950/90 via-[#0E1128] to-sky-950/90 p-4 text-center">
                <Music2 className="h-12 w-12 text-violet-300/80" aria-hidden="true" />
                <span className="line-clamp-2 text-xs font-medium text-slate-300">{song.title}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata + Player + Grouped Actions */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1. Primary Identity: Title, Creator, Spec Line, Style */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold leading-snug text-white">
              {song.title}
            </h2>

            {song.creator && (
              <p className="text-sm font-medium text-indigo-100/90">
                سازنده: <span dir="auto">{song.creator}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-400 tabular-nums">
              <span dir="ltr" className="font-medium text-indigo-200">
                {song.modelName}
              </span>
              {song.durationText && <span>مدت: {song.durationText}</span>}
              <span dir="ltr">فرمت: {formatUpper}</span>
              {song.fileSizeBytes && <span dir="ltr">{formatBytes(song.fileSizeBytes)}</span>}
            </div>

            {song.styleTags && (
              <p className="text-xs leading-relaxed text-slate-400 text-start">
                <span dir="auto">{song.styleTags}</span>
              </p>
            )}
          </div>

          {/* Non-MP3 format notification */}
          {!isMp3 && song.audioFormat !== 'unknown' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-xs sm:text-sm text-sky-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
              <span>
                فایل عمومی ارائه‌شده توسط سرور با فرمت واقعی{' '}
                <strong className="font-semibold" dir="ltr">
                  {formatUpper}
                </strong>{' '}
                است و بدون تبدیل یا افت کیفیت با همین پسوند ذخیره می‌شود.
              </span>
            </div>
          )}

          {/* 2. HTML5 Audio Preview Player */}
          <div className="border-t border-indigo-200/10 pt-4">
            <audio
              ref={audioRef}
              preload="metadata"
              src={streamUrl}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDuration(d);
                updateBuffered(e.currentTarget);
              }}
              onProgress={(e) => updateBuffered(e.currentTarget)}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
                updateBuffered(e.currentTarget);
              }}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onError={() => {
                setAudioError('دریافت جریان صوتی برای پیش‌نمایش انجام نشد.');
                setIsPlaying(false);
              }}
            />

            <div
              dir="ltr"
              className="flex flex-col gap-3 rounded-xl border border-indigo-300/15 bg-[#050610]/90 p-3.5 sm:p-4"
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={togglePlayback}
                  aria-label={isPlaying ? 'توقف پخش' : 'پخش پیش‌نمایش آهنگ'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="h-5 w-5 fill-current translate-x-0.5" aria-hidden="true" />
                  )}
                </button>

                {effectiveDuration > 0 && (
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSkipBy(-10)}
                      aria-label="عقب بردن ۱۰ ثانیه"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSkipBy(10)}
                      aria-label="جلو بردن ۱۰ ثانیه"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                  <AudioWaveformVisualizer
                    analyser={analyserNode}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={effectiveDuration}
                    bufferedEnd={bufferedEnd}
                    onSeek={handleSeek}
                  />

                  {effectiveDuration > 0 ? (
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                      <span className="text-slate-200">{formatAudioClock(currentTime)}</span>
                      <span className="text-indigo-200/60">
                        {Math.round(progressPct)}% · -{formatAudioClock(remainingSeconds)}
                      </span>
                      <span>{formatAudioClock(effectiveDuration)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                      <span>{formatAudioClock(currentTime)}</span>
                      <span>{song.durationText || 'پیش‌نمایش صوتی'}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'وصل صدا' : 'قطع صدا'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {audioError && (
              <p className="mt-2 text-xs text-amber-300" role="status">
                {audioError}
              </p>
            )}
          </div>

          {/* 3. Unified Action Zone: Primary Download + Share File + Utility Copy Links */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={!song.downloadable || downloadState === 'downloading'}
                onClick={handleDownload}
                className="inline-flex min-h-[50px] flex-1 sm:flex-initial items-center justify-center gap-2.5 rounded-xl bg-gradient-to-l from-violet-600 via-indigo-600 to-sky-600 px-6 py-3 text-base font-semibold text-white whitespace-nowrap shrink-0 shadow-[0_8px_28px_-6px_rgba(99,102,241,0.6)] transition-all hover:from-violet-500 hover:via-indigo-500 hover:to-sky-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
              >
                {downloadState === 'downloading' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>
                      در حال دریافت...
                      {downloadProgress !== null ? ` (${downloadProgress}%)` : ''}
                    </span>
                  </>
                ) : downloadState === 'done' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    <span>ذخیره شد — دانلود مجدد</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" aria-hidden="true" />
                    <span>{downloadLabel}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!song.downloadable || shareState === 'preparing'}
                onClick={() => void handleShareAudioFile()}
                aria-label="اشتراک‌گذاری خود فایل آهنگ در تلگرام و پیام‌رسان‌ها"
                className="inline-flex min-h-[50px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl border border-sky-400/35 bg-sky-500/15 px-5 py-3 text-sm font-semibold text-sky-100 whitespace-nowrap shrink-0 transition-colors hover:bg-sky-500/25 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
              >
                {shareState === 'preparing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>آماده‌سازی فایل...</span>
                  </>
                ) : shareState === 'ready-retry' ? (
                  <>
                    <Share2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    <span className="text-emerald-200">ارسال فایل آماده</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 text-sky-300" aria-hidden="true" />
                    <span>اشتراک‌گذاری فایل</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!song.downloadable || !song.audioUrl}
                onClick={() => void handleCopyDownloadUrl()}
                aria-label="کپی لینک دانلود مستقیم فایل صوتی"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-violet-300/25 bg-violet-500/15 px-3.5 py-2 text-xs font-medium text-violet-100 whitespace-nowrap shrink-0 transition-colors hover:bg-violet-500/25 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
              >
                {copiedDownloadUrlRecently ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    <span className="text-emerald-200">لینک دانلود کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 text-violet-300" aria-hidden="true" />
                    <span>کپی لینک دانلود</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleCopyUrl()}
                aria-label="کپی لینک صفحه آهنگ"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-indigo-300/20 bg-indigo-500/10 px-3.5 py-2 text-xs font-medium text-indigo-100 whitespace-nowrap shrink-0 transition-colors hover:bg-indigo-500/20 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
              >
                {copiedUrlRecently ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    <span className="text-emerald-200">کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span>کپی لینک صفحه</span>
                  </>
                )}
              </button>

              <a
                href={song.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-300 whitespace-nowrap shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
              >
                <span>مشاهده در سایت</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            {/* Filename kept directly beside/under the download action it belongs to */}
            <p className="text-xs text-slate-400">
              فایل خروجی:{' '}
              <span className="font-medium text-slate-200" dir="auto">
                {song.downloadFilename}
              </span>
            </p>
          </div>

          {downloadState === 'downloading' && (
            <div className="space-y-1.5" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-violet-500 via-indigo-500 to-sky-400 transition-[width] duration-150"
                  style={{ width: `${downloadProgress ?? 35}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 tabular-nums">
                <span dir="ltr">
                  {formatBytes(downloadedBytes)}
                  {totalDownloadBytes ? ` / ${formatBytes(totalDownloadBytes)}` : ''}
                </span>
                <span>{downloadProgress !== null ? `${downloadProgress}%` : 'در حال انتقال...'}</span>
              </div>
            </div>
          )}

          {downloadState === 'done' && (
            <p className="text-xs font-medium text-emerald-300" role="status">
              فایل صوتی معتبر با فرمت {formatUpper} روی دستگاه ذخیره شد.
            </p>
          )}

          {/* Optional Lyrics Toggle */}
          {song.lyrics.length > 0 && (
            <div className="border-t border-indigo-200/10 pt-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  aria-expanded={lyricsOpen}
                  onClick={() => setLyricsOpen((prev) => !prev)}
                  className="inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-indigo-100 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 rounded cursor-pointer"
                >
                  <span>متن آهنگ ({song.lyrics.length} بخش)</span>
                  {lyricsOpen ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {lyricsOpen && (
                  <button
                    type="button"
                    onClick={() => void handleCopyLyrics()}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-indigo-300/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-100 transition-colors hover:bg-indigo-500/20 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
                  >
                    {copiedLyricsRecently ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                        <span className="text-emerald-200">کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>کپی متن</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {lyricsOpen && (
                <div className="mt-3 space-y-4 rounded-xl border border-indigo-300/15 bg-[#050610]/90 p-4">
                  {song.lyrics.map((sec, idx) => (
                    <div key={`${sec.heading}-${idx}`} className="space-y-1">
                      {sec.heading && (
                        <h3 className="text-xs font-semibold text-violet-300" dir="ltr">
                          {sec.heading}
                        </h3>
                      )}
                      <p className="text-sm leading-7 text-slate-200">
                        {sec.lines.map((line, lineIdx) => (
                          <span key={lineIdx} className="block">
                            {line}
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function triggerBrowserSave(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
}
