import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';
import { ErrorBanner } from './components/ErrorBanner.tsx';
import { Header } from './components/Header.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { RecentSearches } from './components/RecentSearches.tsx';
import { SongResultCard } from './components/SongResultCard.tsx';
import { SongUrlForm } from './components/SongUrlForm.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import type { AnalyzeResponse, SongErrorCode, SongMetadata } from './shared/types.ts';
import {
  addRecentSearchItem,
  clearRecentSearchesStorage,
  loadRecentSearches,
  removeRecentSearchItem,
  saveRecentSearches,
  type HistorySortOrder,
  type RecentSearchItem,
} from './utils/history.ts';
import {
  incrementAnalyzedCount,
  incrementDownloadCount,
  loadUsageStats,
  saveUsageStats,
  type UsageStats,
} from './utils/stats.ts';

type ViewState =
  | { status: 'idle' }
  | { status: 'loading'; targetUrl: string }
  | { status: 'success'; song: SongMetadata }
  | {
      status: 'error';
      errorCode: SongErrorCode;
      message: string;
      details: string;
      partialSong?: Partial<SongMetadata>;
    };

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [viewState, setViewState] = useState<ViewState>({ status: 'idle' });
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() =>
    loadRecentSearches()
  );
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>('newest');
  const [usageStats, setUsageStats] = useState<UsageStats>(() => loadUsageStats());

  const bumpAnalyzedStat = () => {
    setUsageStats((prev) => {
      const next = incrementAnalyzedCount(prev);
      saveUsageStats(next);
      return next;
    });
  };

  const bumpDownloadStat = () => {
    setUsageStats((prev) => {
      const next = incrementDownloadCount(prev);
      saveUsageStats(next);
      return next;
    });
  };

  const recordRecentSearch = (item: RecentSearchItem) => {
    setRecentSearches((prev) => {
      const next = addRecentSearchItem(prev, item);
      saveRecentSearches(next);
      return next;
    });
  };

  const runAnalysis = async (targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      setViewState({
        status: 'error',
        errorCode: 'INVALID_URL',
        message: 'لینک نامعتبر است.',
        details: 'لطفاً ابتدا لینک اشتراک‌گذاری آهنگ از سایت acemusic.ai را وارد کنید.',
      });
      return;
    }

    setViewState({ status: 'loading', targetUrl: trimmed });

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = (await response.json().catch(() => null)) as AnalyzeResponse | null;
      if (!data) {
        setViewState({
          status: 'error',
          errorCode: 'SERVER_UNREACHABLE',
          message: 'سرور پاسخ نمی‌دهد.',
          details: 'پاسخ معتبری از سرور تحلیل دریافت نشد.',
        });
        return;
      }

      if (data.ok) {
        bumpAnalyzedStat();
        recordRecentSearch({
          songId: data.song.songId,
          title: data.song.title,
          url: data.song.normalizedUrl,
          creator: data.song.creator,
          durationText: data.song.durationText,
          modelName: data.song.modelName,
          searchedAt: Date.now(),
        });
        setViewState({
          status: 'success',
          song: data.song,
        });
      } else {
        if (data.song?.songId && data.song?.title && data.song?.normalizedUrl) {
          recordRecentSearch({
            songId: data.song.songId,
            title: data.song.title,
            url: data.song.normalizedUrl,
            creator: data.song.creator,
            durationText: data.song.durationText,
            modelName: data.song.modelName,
            searchedAt: Date.now(),
          });
        }
        setViewState({
          status: 'error',
          errorCode: data.errorCode,
          message: data.message,
          details: data.details,
          partialSong: data.song,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isCors = msg.includes('cors') || msg.includes('cross-origin');
      setViewState({
        status: 'error',
        errorCode: isCors ? 'CORS_BLOCKED' : 'SERVER_UNREACHABLE',
        message: isCors ? 'دریافت فایل توسط CORS مسدود شده است.' : 'سرور پاسخ نمی‌دهد.',
        details: isCors
          ? 'مرورگر دسترسی مستقیم به منبع خارجی را مسدود کرده است.'
          : 'ارتباط با سرور برنامه برقرار نشد. لطفاً وضعیت اجرا و اتصال اینترنت را بررسی کنید.',
      });
    }
  };

  useEffect(() => {
    const initialQueryUrl = new URLSearchParams(window.location.search).get('url');
    if (initialQueryUrl && initialQueryUrl.trim().length > 0) {
      setUrlInput(initialQueryUrl.trim());
      void runAnalysis(initialQueryUrl.trim());
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runAnalysis(urlInput);
  };

  const handleSelectRecent = (recentUrl: string) => {
    setUrlInput(recentUrl);
    void runAnalysis(recentUrl);
  };

  const handleRemoveRecent = (recentUrl: string) => {
    setRecentSearches((prev) => {
      const next = removeRecentSearchItem(prev, recentUrl);
      saveRecentSearches(next);
      return next;
    });
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    clearRecentSearchesStorage();
  };

  const handleDownloadError = (code: SongErrorCode, message: string, details: string) => {
    setViewState({
      status: 'error',
      errorCode: code,
      message,
      details,
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#04050B] text-slate-100">
      {/* Galactic starfield & multi-layered nebula backdrop */}
      <div
        aria-hidden="true"
        className="cosmic-starfield pointer-events-none absolute inset-0 opacity-75"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(124,58,237,0.26),rgba(56,189,248,0.1)_48%,transparent_80%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px] bg-[radial-gradient(ellipse_60%_50%_at_20%_100%,rgba(79,70,229,0.16),transparent_75%)]"
      />

      <Header />

      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        {/* Centered Balanced Galactic Hero */}
        <section className="mx-auto max-w-2xl space-y-3.5 text-center">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[42px] lg:leading-[1.25]">
            دانلود مستقیم آهنگ‌های{' '}
            <span className="bg-gradient-to-l from-violet-300 via-indigo-200 to-sky-300 bg-clip-text text-transparent">
              ACE Music
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            لینک اشتراک‌گذاری آهنگ را وارد کنید تا مشخصات واقعی بررسی شده و فایل صوتی اصلی با کیفیت کامل ذخیره شود.
          </p>
        </section>

        {/* Primary URL Input Form */}
        <SongUrlForm
          url={urlInput}
          onChangeUrl={setUrlInput}
          onSubmit={handleSubmit}
          isLoading={viewState.status === 'loading'}
        />

        {/* Recent Searches History Cards */}
        <RecentSearches
          items={recentSearches}
          sortOrder={sortOrder}
          onChangeSortOrder={setSortOrder}
          activeUrl={viewState.status === 'success' ? viewState.song.normalizedUrl : undefined}
          onSelect={handleSelectRecent}
          onRemove={handleRemoveRecent}
          onClearAll={handleClearRecent}
        />

        {/* Personal Engagement Stats Dashboard */}
        <StatsBar stats={usageStats} />

        {/* Dynamic Status / Result Area */}
        <AnimatePresence mode="wait">
          {viewState.status === 'loading' && (
            <motion.section
              key="loading"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              aria-live="polite"
              className="rounded-2xl border border-indigo-300/15 bg-[#0B0D1D]/85 p-6 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-indigo-400/15" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-indigo-400/15" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-indigo-400/15" />
                  <p className="text-xs sm:text-sm text-slate-300">
                    در حال دریافت صفحه عمومی آهنگ، تحلیل متادیتا و راستی‌آزمایی فایل صوتی...
                  </p>
                </div>
              </div>
            </motion.section>
          )}

          {viewState.status === 'error' && (
            <motion.div
              key={`error-${viewState.errorCode}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              <ErrorBanner
                errorCode={viewState.errorCode}
                message={viewState.message}
                details={viewState.details}
                partialSong={viewState.partialSong}
                onRetry={() => void runAnalysis(urlInput)}
              />
            </motion.div>
          )}

          {viewState.status === 'success' && (
            <motion.div
              key={`song-${viewState.song.songId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <SongResultCard
                song={viewState.song}
                onDownloadSuccess={bumpDownloadStat}
                onDownloadError={handleDownloadError}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <OfflineIndicator />
    </div>
  );
}
