import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDirectDownloadUrl,
  canNavigatorShareFiles,
  canNavigatorShareUrl,
  getDirectAudioCopyUrl,
  getShareErrorKind,
} from './share.ts';

test('buildDirectDownloadUrl creates encoded /api/download URL preserving sh token', () => {
  const url = buildDirectDownloadUrl(
    'https://example.com/',
    'https://acemusic.ai/song/a3pxxki7ikq8?sh=P0gf84B8iyj'
  );
  assert.equal(
    url,
    'https://example.com/api/download?songUrl=https%3A%2F%2Facemusic.ai%2Fsong%2Fa3pxxki7ikq8%3Fsh%3DP0gf84B8iyj'
  );
});

test('getDirectAudioCopyUrl prefers direct audio source URL and falls back to /api/download', () => {
  assert.equal(
    getDirectAudioCopyUrl(
      'https://acemusic.ai/data/so_0d673bb7b8164952a6f54e2e.mp3',
      'https://example.com',
      'https://acemusic.ai/song/a3pxxki7ikq8?sh=P0gf84B8iyj'
    ),
    'https://acemusic.ai/data/so_0d673bb7b8164952a6f54e2e.mp3'
  );
  assert.equal(
    getDirectAudioCopyUrl(
      null,
      'https://example.com',
      'https://acemusic.ai/song/a3pxxki7ikq8?sh=P0gf84B8iyj'
    ),
    'https://example.com/api/download?songUrl=https%3A%2F%2Facemusic.ai%2Fsong%2Fa3pxxki7ikq8%3Fsh%3DP0gf84B8iyj'
  );
});

test('canNavigatorShareFiles checks both share and canShare safely', () => {
  const dummyFile = new File(['abc'], 'song.mp3', { type: 'audio/mpeg' });
  assert.equal(canNavigatorShareFiles(undefined, dummyFile), false);
  assert.equal(canNavigatorShareFiles({ share: () => {} }, dummyFile), false);
  assert.equal(
    canNavigatorShareFiles(
      { share: () => {}, canShare: () => true },
      dummyFile
    ),
    true
  );
  assert.equal(
    canNavigatorShareFiles(
      {
        share: () => {},
        canShare: () => {
          throw new TypeError('unsupported');
        },
      },
      dummyFile
    ),
    false
  );
});

test('canNavigatorShareUrl checks navigator.share and optional canShare cleanly', () => {
  const payload = { title: 'Track', url: 'https://acemusic.ai/data/song.mp3' };
  assert.equal(canNavigatorShareUrl(undefined, payload), false);
  assert.equal(canNavigatorShareUrl({ share: () => {} }, payload), true);
  assert.equal(canNavigatorShareUrl({ share: () => {}, canShare: () => false }, payload), false);
  assert.equal(canNavigatorShareUrl({ share: () => {}, canShare: () => true }, payload), true);
});

test('getShareErrorKind classifies AbortError, NotAllowedError, and other errors', () => {
  assert.equal(getShareErrorKind(new DOMException('cancel', 'AbortError')), 'abort');
  assert.equal(getShareErrorKind(new DOMException('gesture expired', 'NotAllowedError')), 'not-allowed');
  assert.equal(getShareErrorKind(new Error('network fail')), 'other');
});
