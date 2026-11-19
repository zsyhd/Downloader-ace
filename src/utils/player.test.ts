import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLyricsText,
  formatPlaybackSpeed,
  getNextPlaybackSpeed,
  parseStyleTags,
} from './player.ts';

test('getNextPlaybackSpeed cycles cleanly through supported playback rates', () => {
  assert.equal(getNextPlaybackSpeed(1), 1.25);
  assert.equal(getNextPlaybackSpeed(1.25), 1.5);
  assert.equal(getNextPlaybackSpeed(1.5), 2);
  assert.equal(getNextPlaybackSpeed(2), 0.75);
  assert.equal(getNextPlaybackSpeed(0.75), 1);
  assert.equal(getNextPlaybackSpeed(3), 1);
  assert.equal(formatPlaybackSpeed(1.25), '1.25×');
});

test('parseStyleTags splits, trims, and deduplicates comma-separated genre tags', () => {
  assert.deepEqual(parseStyleTags('female vocal, pop, acoustic ballad, Pop, '), [
    'female vocal',
    'pop',
    'acoustic ballad',
  ]);
  assert.deepEqual(parseStyleTags('پاپ، آرام؛ احساسی'), ['پاپ', 'آرام', 'احساسی']);
  assert.deepEqual(parseStyleTags(null), []);
});

test('formatLyricsText formats title, creator, and section headings cleanly', () => {
  const text = formatLyricsText('رؤیای خاک‌خورده', 'زهرا سادات', [
    { heading: 'Verse 1', lines: ['خط اول', 'خط دوم'] },
    { heading: '', lines: ['خط سوم'] },
  ]);
  assert.equal(
    text,
    'رؤیای خاک‌خورده\nسازنده: زهرا سادات\n\n[Verse 1]\nخط اول\nخط دوم\n\nخط سوم'
  );
  assert.equal(formatLyricsText('Track', null, []), '');
});
