import { Loader2, Search, X } from 'lucide-react';
import type { FormEvent } from 'react';

interface SongUrlFormProps {
  url: string;
  onChangeUrl: (next: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
}

export function SongUrlForm({
  url,
  onChangeUrl,
  onSubmit,
  isLoading,
}: SongUrlFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <div className="rounded-2xl border border-indigo-300/15 bg-[#0B0D1D]/80 p-4 backdrop-blur-xl shadow-[0_20px_60px_-24px_rgba(79,70,229,0.35)] sm:p-6">
        <label
          htmlFor="song-url-input"
          className="mb-2.5 block text-sm font-medium text-indigo-100/90"
        >
          لینک آهنگ در acemusic.ai
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative flex-1">
            <input
              id="song-url-input"
              name="songUrl"
              type="url"
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => onChangeUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && url.length > 0 && !isLoading) {
                  onChangeUrl('');
                }
              }}
              placeholder="https://acemusic.ai/song/{songId}?sh={shareToken}"
              className="h-13 w-full rounded-xl border border-indigo-300/20 bg-[#050610]/90 pr-4 pl-11 text-left font-mono text-xs sm:text-sm text-white placeholder:text-slate-500 transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            {url.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => onChangeUrl('')}
                aria-label="پاک کردن لینک"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 via-indigo-600 to-sky-600 px-6 py-3 text-sm sm:text-base font-semibold text-white whitespace-nowrap shrink-0 shadow-[0_8px_28px_-6px_rgba(99,102,241,0.65)] transition-all hover:from-violet-500 hover:via-indigo-500 hover:to-sky-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span>در حال بررسی...</span>
              </>
            ) : (
              <>
                <Search className="h-5 w-5" aria-hidden="true" />
                <span>بررسی آهنگ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
