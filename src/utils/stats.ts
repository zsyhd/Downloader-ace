export interface UsageStats {
  totalAnalyzed: number;
  successfulDownloads: number;
}

export const STATS_STORAGE_KEY = 'ace_music_usage_stats_v1';

export const DEFAULT_USAGE_STATS: UsageStats = {
  totalAnalyzed: 0,
  successfulDownloads: 0,
};

export function parseStoredStats(rawJson: string | null): UsageStats {
  if (!rawJson) return { ...DEFAULT_USAGE_STATS };
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_USAGE_STATS };

    const totalAnalyzed =
      typeof parsed.totalAnalyzed === 'number' &&
      Number.isFinite(parsed.totalAnalyzed) &&
      parsed.totalAnalyzed >= 0
        ? Math.floor(parsed.totalAnalyzed)
        : 0;

    const successfulDownloads =
      typeof parsed.successfulDownloads === 'number' &&
      Number.isFinite(parsed.successfulDownloads) &&
      parsed.successfulDownloads >= 0
        ? Math.floor(parsed.successfulDownloads)
        : 0;

    return { totalAnalyzed, successfulDownloads };
  } catch {
    return { ...DEFAULT_USAGE_STATS };
  }
}

export function incrementAnalyzedCount(stats: UsageStats): UsageStats {
  return {
    ...stats,
    totalAnalyzed: stats.totalAnalyzed + 1,
  };
}

export function incrementDownloadCount(stats: UsageStats): UsageStats {
  return {
    ...stats,
    successfulDownloads: stats.successfulDownloads + 1,
  };
}

export function loadUsageStats(): UsageStats {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_USAGE_STATS };
  }
  try {
    return parseStoredStats(window.localStorage.getItem(STATS_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_USAGE_STATS };
  }
}

export function saveUsageStats(stats: UsageStats): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}
