import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRecentSearchItem,
  parseStoredHistory,
  removeRecentSearchItem,
  shouldDeleteOnSwipe,
  sortRecentSearches,
  type RecentSearchItem,
} from './history.ts';

test('addRecentSearchItem prepends newest item, deduplicates URL, and caps at 5', () => {
  let list: RecentSearchItem[] = [];
  for (let i = 1; i <= 6; i += 1) {
    list = addRecentSearchItem(list, {
      songId: `id${i}`,
      title: `Song ${i}`,
      url: `https://acemusic.ai/song/id${i}?sh=tok${i}`,
      searchedAt: i * 1000,
    });
  }

  assert.equal(list.length, 5);
  assert.equal(list[0].songId, 'id6');
  assert.equal(list[4].songId, 'id2');

  list = addRecentSearchItem(list, {
    songId: 'id3',
    title: 'Song 3 Updated',
    url: 'https://acemusic.ai/song/id3?sh=tok3',
    searchedAt: 9999,
  });

  assert.equal(list.length, 5);
  assert.equal(list[0].songId, 'id3');
  assert.equal(list[0].title, 'Song 3 Updated');
  assert.equal(list.filter((item) => item.songId === 'id3').length, 1);
});

test('removeRecentSearchItem removes matching URL cleanly', () => {
  const initial: RecentSearchItem[] = [
    { songId: 'a', title: 'A', url: 'https://acemusic.ai/song/a', searchedAt: 1 },
    { songId: 'b', title: 'B', url: 'https://acemusic.ai/song/b', searchedAt: 2 },
  ];
  const next = removeRecentSearchItem(initial, 'https://acemusic.ai/song/a');
  assert.equal(next.length, 1);
  assert.equal(next[0].songId, 'b');
});

test('sortRecentSearches sorts by newest, oldest, and alphabetical title without mutating source', () => {
  const items: RecentSearchItem[] = [
    { songId: '1', title: 'باران', url: 'https://acemusic.ai/song/1', searchedAt: 200 },
    { songId: '2', title: 'آسمان', url: 'https://acemusic.ai/song/2', searchedAt: 100 },
    { songId: '3', title: 'دریا', url: 'https://acemusic.ai/song/3', searchedAt: 300 },
  ];

  const newest = sortRecentSearches(items, 'newest');
  assert.deepEqual(
    newest.map((x) => x.songId),
    ['3', '1', '2']
  );

  const oldest = sortRecentSearches(items, 'oldest');
  assert.deepEqual(
    oldest.map((x) => x.songId),
    ['2', '1', '3']
  );

  const alpha = sortRecentSearches(items, 'title-asc');
  assert.deepEqual(
    alpha.map((x) => x.title),
    ['آسمان', 'باران', 'دریا']
  );

  // Original array unchanged
  assert.equal(items[0].songId, '1');
});

test('parseStoredHistory safely handles corrupted JSON and filters invalid entries', () => {
  assert.deepEqual(parseStoredHistory('{bad json'), []);
  assert.deepEqual(parseStoredHistory(null), []);

  const mixed = JSON.stringify([
    { songId: 'ok1', title: 'Valid', url: 'https://acemusic.ai/song/ok1', searchedAt: 10 },
    { songId: 'bad', title: '', url: 'https://acemusic.ai/song/bad' },
    'invalid',
  ]);
  const parsed = parseStoredHistory(mixed);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].songId, 'ok1');
});

test('shouldDeleteOnSwipe detects horizontal swipe thresholds and quick flicks in either direction', () => {
  assert.equal(shouldDeleteOnSwipe(-90, 0), true);
  assert.equal(shouldDeleteOnSwipe(92, 0), true);
  assert.equal(shouldDeleteOnSwipe(-45, -500), true);
  assert.equal(shouldDeleteOnSwipe(40, 460), true);
  assert.equal(shouldDeleteOnSwipe(-30, -100), false);
  assert.equal(shouldDeleteOnSwipe(12, 600), false);
  assert.equal(shouldDeleteOnSwipe(0, 0), false);
});
