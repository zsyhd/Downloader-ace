import { Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-indigo-200/10 bg-[#05060F]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3.5 sm:px-6">
        <a
          href="#"
          className="flex items-center gap-2 sm:gap-2.5 text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-white shadow-[0_0_20px_-4px_rgba(124,58,237,0.7)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>ACE Music Downloader</span>
        </a>

        <p className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/20 bg-gradient-to-l from-rose-500/12 via-fuchsia-500/10 to-violet-500/10 px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-100 whitespace-nowrap shrink-0 shadow-[0_0_24px_-8px_rgba(244,63,94,0.55)]">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 drop-shadow-[0_0_8px_rgba(244,63,94,0.75)]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="sara-heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDA4AF" />
                <stop offset="50%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#C026D3" />
              </linearGradient>
            </defs>
            <path
              fill="url(#sara-heart-grad)"
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          <span>تقدیم به سارا</span>
        </p>
      </div>
    </header>
  );
}
