export interface RecentSearchItem {
  songId: string;
  title: string;
  url: string;
  creator?: string | null;
  durationText?: string | null;
  modelName?: string | null;
  searchedAt: number;
}

export type HistorySortOrder = 'newest' | 'oldest' | 'title-asc';

export const HISTORY_STORAGE_KEY = 'ace_music_recent_searches_v1';
export const MAX_RECENT_SEARCHES = 5;

export function parseStoredHistory(rawJson: string | null): RecentSearchItem[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentSearchItem =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.url === 'string' &&
          item.url.trim().length > 0 &&
          typeof item.title === 'string' &&
          item.title.trim().length > 0 &&
          typeof item.songId === 'string'
      )
      .map((item) => ({
        ...item,
        searchedAt: typeof item.searchedAt === 'number' && Number.isFinite(item.searchedAt) ? item.searchedAt : 0,
      }))
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function addRecentSearchItem(
  existing: RecentSearchItem[],
  next: RecentSearchItem,
  limit = MAX_RECENT_SEARCHES
): RecentSearchItem[] {
  const normalizedTarget = next.url.trim();
  const filtered = existing.filter((item) => item.url.trim() !== normalizedTarget);
  return [{ ...next, url: normalizedTarget }, ...filtered].slice(0, Math.max(1, limit));
}

export function removeRecentSearchItem(
  existing: RecentSearchItem[],
  url: string
): RecentSearchItem[] {
  const target = url.trim();
  return existing.filter((item) => item.url.trim() !== target);
}

export const SWIPE_DELETE_OFFSET_PX = 88;
export const SWIPE_DELETE_VELOCITY_PX = 420;
export const SWIPE_DELETE_MIN_FLICK_OFFSET_PX = 36;

export function shouldDeleteOnSwipe(offsetX: number, velocityX: number): boolean {
  const absOffset = Math.abs(offsetX);
  const absVelocity = Math.abs(velocityX);
  if (absOffset >= SWIPE_DELETE_OFFSET_PX) return true;
  if (absVelocity >= SWIPE_DELETE_VELOCITY_PX && absOffset >= SWIPE_DELETE_MIN_FLICK_OFFSET_PX) {
    return true;
  }
  return false;
}

export function sortRecentSearches(
  items: RecentSearchItem[],
  sortOrder: HistorySortOrder
): RecentSearchItem[] {
  const copy = [...items];
  if (sortOrder === 'oldest') {
    return copy.sort((a, b) => a.searchedAt - b.searchedAt);
  }
  if (sortOrder === 'title-asc') {
    return copy.sort((a, b) =>
      a.title.localeCompare(b.title, 'fa', { sensitivity: 'base', numeric: true })
    );
  }
  // 'newest'
  return copy.sort((a, b) => b.searchedAt - a.searchedAt);
}

export function loadRecentSearches(): RecentSearchItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    return parseStoredHistory(window.localStorage.getItem(HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecentSearches(items: RecentSearchItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

export function clearRecentSearchesStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
