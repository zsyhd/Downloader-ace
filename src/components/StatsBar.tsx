import { DownloadCloud, SearchCheck } from 'lucide-react';
import type { UsageStats } from '../utils/stats.ts';

interface StatsBarProps {
  stats: UsageStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <section
      aria-label="آمار فعالیت شخصی شما"
      className="overflow-hidden rounded-2xl border border-indigo-300/15 bg-[#0B0D1D]/75 backdrop-blur-md"
    >
      <div className="grid grid-cols-1 divide-y divide-indigo-300/15 sm:grid-cols-2 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <SearchCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="truncate text-xs sm:text-sm font-medium text-slate-300">
              آهنگ‌های بررسی‌شده
            </span>
          </div>
          <span
            data-testid="stat-total-analyzed"
            className="font-mono text-lg sm:text-xl font-bold text-white tabular-nums shrink-0"
          >
            {stats.totalAnalyzed}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              <DownloadCloud className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="truncate text-xs sm:text-sm font-medium text-slate-300">
              دانلودهای موفق
            </span>
          </div>
          <span
            data-testid="stat-successful-downloads"
            className="font-mono text-lg sm:text-xl font-bold text-white tabular-nums shrink-0"
          >
            {stats.successfulDownloads}
          </span>
        </div>
      </div>
    </section>
  );
}
