import { ArrowUpDown, ChevronDown, History, Trash2, X } from 'lucide-react';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'motion/react';
import { useRef } from 'react';
import {
  shouldDeleteOnSwipe,
  sortRecentSearches,
  type HistorySortOrder,
  type RecentSearchItem,
} from '../utils/history.ts';

interface RecentSearchesProps {
  items: RecentSearchItem[];
  sortOrder: HistorySortOrder;
  onChangeSortOrder: (order: HistorySortOrder) => void;
  activeUrl?: string;
  onSelect: (url: string) => void;
  onRemove: (url: string) => void;
  onClearAll: () => void;
}

interface SwipeableRecentCardProps {
  item: RecentSearchItem;
  isActive: boolean;
  onSelect: (url: string) => void;
  onRemove: (url: string) => void;
}

function SwipeableRecentCard({
  item,
  isActive,
  onSelect,
  onRemove,
}: SwipeableRecentCardProps) {
  const x = useMotionValue(0);
  const backdropOpacity = useTransform(x, [-110, -20, 0, 20, 110], [1, 0.3, 0, 0.3, 1]);
  const didDragRef = useRef(false);
  const isRemovingRef = useRef(false);

  const handleDragStart = () => {
    didDragRef.current = false;
  };

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 8) {
      didDragRef.current = true;
    }
  };

  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isRemovingRef.current) return;

    if (shouldDeleteOnSwipe(info.offset.x, info.velocity.x)) {
      isRemovingRef.current = true;
      const targetX = info.offset.x < 0 ? -380 : 380;
      await animate(x, targetX, { duration: 0.16, ease: [0.22, 1, 0.36, 1] });
      onRemove(item.url);
      return;
    }

    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      className="relative overflow-hidden rounded-xl"
      data-testid="recent-search-card"
    >
      {/* Swipe-to-delete reveal layer */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: backdropOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-xl border border-rose-400/35 bg-rose-500/20 px-4 text-rose-200"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <Trash2 className="h-4 w-4" />
          <span>حذف</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span>حذف</span>
          <Trash2 className="h-4 w-4" />
        </span>
      </motion.div>

      {/* Draggable foreground card */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.45}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={(event, info) => void handleDragEnd(event, info)}
        style={{ x, touchAction: 'pan-y' }}
        className={`group relative flex items-stretch overflow-hidden rounded-xl border backdrop-blur-md transition-colors ${
          isActive
            ? 'border-violet-400/60 bg-[#181535]'
            : 'border-indigo-300/15 bg-[#0B0D1D] hover:border-violet-400/40 hover:bg-[#12152E]'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (didDragRef.current || isRemovingRef.current) return;
            onSelect(item.url);
          }}
          aria-label={`بررسی مجدد آهنگ ${item.title}`}
          className="flex min-h-[58px] min-w-0 flex-1 flex-col justify-center gap-1 px-3.5 py-2.5 text-start focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-400 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-white">
              {item.title}
            </span>
            {item.durationText && (
              <span
                dir="ltr"
                className="shrink-0 font-mono text-[11px] text-indigo-200/75 tabular-nums"
              >
                {item.durationText}
              </span>
            )}
          </div>
          <span
            dir="ltr"
            className="truncate font-mono text-[11px] text-slate-400"
          >
            {item.url.replace(/^https?:\/\//, '')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onRemove(item.url)}
          aria-label={`حذف ${item.title} از تاریخچه`}
          className="flex min-w-[40px] shrink-0 items-center justify-center border-s border-indigo-300/15 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-400 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </motion.div>
    </motion.div>
  );
}

export function RecentSearches({
  items,
  sortOrder,
  onChangeSortOrder,
  activeUrl,
  onSelect,
  onRemove,
  onClearAll,
}: RecentSearchesProps) {
  if (items.length === 0) return null;

  const sortedItems = sortRecentSearches(items, sortOrder);

  return (
    <section aria-labelledby="recent-searches-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
          <History className="h-4 w-4 text-violet-300" aria-hidden="true" />
          <h2 id="recent-searches-heading">جستجوهای اخیر</h2>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center">
            <label htmlFor="history-sort-select" className="sr-only">
              مرتب‌سازی تاریخچه
            </label>
            <ArrowUpDown
              className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-indigo-300/80"
              aria-hidden="true"
            />
            <select
              id="history-sort-select"
              value={sortOrder}
              onChange={(e) => onChangeSortOrder(e.target.value as HistorySortOrder)}
              aria-label="مرتب‌سازی تاریخچه"
              className="min-h-[36px] appearance-none rounded-lg border border-indigo-300/20 bg-[#0B0D1D]/90 ps-8 pe-8 text-xs font-medium text-slate-200 transition-colors hover:border-indigo-300/35 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="title-asc">بر اساس عنوان (الف ← ی)</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-2.5 h-3.5 w-3.5 text-indigo-300/80"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>پاک کردن تاریخچه</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {sortedItems.map((item) => (
            <SwipeableRecentCard
              key={item.url}
              item={item}
              isActive={activeUrl?.trim() === item.url.trim()}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
