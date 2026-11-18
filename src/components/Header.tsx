import { Sparkles } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';

export function Header() {
  return (
    <header className="border-b border-indigo-200/10 bg-[#05060F]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <a
          href="#"
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-white shadow-[0_0_20px_-4px_rgba(124,58,237,0.7)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>ACE Music Downloader</span>
        </a>

        <PWAInstallButton />
      </div>
    </header>
  );
}
