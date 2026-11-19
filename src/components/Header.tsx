export function Header() {
  return (
    <header className="border-b border-indigo-200/10 bg-[#05060F]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5 text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E163E] via-[#13193B] to-[#0A192F] ring-1 ring-inset ring-indigo-300/30 shadow-[0_6px_22px_-4px_rgba(124,58,237,0.65)]">
            <svg viewBox="0 0 36 36" className="h-7 w-7" aria-hidden="true">
              <defs>
                <linearGradient id="ace-crest-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C4B5FD" />
                  <stop offset="50%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
                <linearGradient id="ace-crest-note" x1="20%" y1="0%" x2="90%" y2="100%">
                  <stop offset="0%" stopColor="#F5F3FF" />
                  <stop offset="55%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
              {/* Outer cosmic vinyl orbit */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="url(#ace-crest-ring)"
                strokeWidth="1.4"
                strokeDasharray="62 14"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Inner subtle harmonic arc */}
              <circle
                cx="18"
                cy="18"
                r="10.2"
                fill="none"
                stroke="url(#ace-crest-ring)"
                strokeWidth="0.9"
                opacity="0.35"
              />
              {/* Stylized beamed music note + starlight spark */}
              <path
                fill="url(#ace-crest-note)"
                d="M15.2 21.6a2.6 2.6 0 1 1-1.6-2.4v-6.8c0-.62.42-1.16 1.02-1.3l6.2-1.45a1.15 1.15 0 0 1 1.41 1.12v7.83a2.6 2.6 0 1 1-1.6-2.4v-4.2l-4.43 1.04v6.76a2.6 2.6 0 0 1-1 1.8Z"
              />
              <circle cx="28.2" cy="9.2" r="1.35" fill="#7DD3FC" />
            </svg>
          </span>

          <span className="bg-gradient-to-l from-white via-indigo-100 to-sky-200 bg-clip-text text-transparent">
            ACE Music
          </span>
        </div>

        <p className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-gradient-to-l from-rose-500/12 via-fuchsia-500/10 to-violet-500/10 px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-100 whitespace-nowrap shrink-0 shadow-[0_0_24px_-10px_rgba(244,63,94,0.45)]">
          <svg
            viewBox="0 0 24 24"
            className="sara-heartbeat h-4 w-4 shrink-0"
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
