import test from 'node:test';
import assert from 'node:assert/strict';
import {
  incrementAnalyzedCount,
  incrementDownloadCount,
  parseStoredStats,
} from './stats.ts';

test('parseStoredStats returns defaults for null, invalid JSON, and negative numbers', () => {
  assert.deepEqual(parseStoredStats(null), { totalAnalyzed: 0, successfulDownloads: 0 });
  assert.deepEqual(parseStoredStats('{broken'), { totalAnalyzed: 0, successfulDownloads: 0 });
  assert.deepEqual(
    parseStoredStats(JSON.stringify({ totalAnalyzed: -5, successfulDownloads: 3.8 })),
    { totalAnalyzed: 0, successfulDownloads: 3 }
  );
});

test('incrementAnalyzedCount and incrementDownloadCount update counters immutably', () => {
  const s0 = { totalAnalyzed: 2, successfulDownloads: 1 };
  const s1 = incrementAnalyzedCount(s0);
  const s2 = incrementDownloadCount(s1);

  assert.deepEqual(s0, { totalAnalyzed: 2, successfulDownloads: 1 });
  assert.deepEqual(s1, { totalAnalyzed: 3, successfulDownloads: 1 });
  assert.deepEqual(s2, { totalAnalyzed: 3, successfulDownloads: 2 });
});
