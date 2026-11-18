import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAudioMagicFormat,
  isAllowedMediaRedirectHost,
  parseAndValidateAceSongUrl,
  sanitizeDownloadFilename,
} from './validation.ts';

test('accepts sample acemusic.ai song URL and preserves sh token', () => {
  const res = parseAndValidateAceSongUrl('https://acemusic.ai/song/a3pxxki7ikq8?sh=P0gf84B8iyj');
  assert.equal(res.valid, true);
  if (res.valid) {
    assert.equal(res.songId, 'a3pxxki7ikq8');
    assert.equal(res.shareToken, 'P0gf84B8iyj');
    assert.equal(res.normalizedUrl, 'https://acemusic.ai/song/a3pxxki7ikq8?sh=P0gf84B8iyj');
  }
});

test('accepts localized acemusic.ai song URLs and bare domain input', () => {
  const res = parseAndValidateAceSongUrl('acemusic.ai/en/song/xyz12345?sh=Abc99');
  assert.equal(res.valid, true);
  if (res.valid) {
    assert.equal(res.songId, 'xyz12345');
    assert.equal(res.shareToken, 'Abc99');
  }
});

test('rejects non-acemusic domains and invalid song paths', () => {
  const evil = parseAndValidateAceSongUrl('https://acemusic.ai.evil.com/song/a3pxxki7ikq8');
  assert.equal(evil.valid, false);

  const wrongPath = parseAndValidateAceSongUrl('https://acemusic.ai/create/');
  assert.equal(wrongPath.valid, false);

  const empty = parseAndValidateAceSongUrl('   ');
  assert.equal(empty.valid, false);
});

test('SSRF redirect host allowlist blocks private IPs and arbitrary external hosts', () => {
  assert.equal(isAllowedMediaRedirectHost('acemusic.ai'), true);
  assert.equal(
    isAllowedMediaRedirectHost('c56f4a80abefb3bfc10991eef7ce3ef8.r2.cloudflarestorage.com'),
    true
  );
  assert.equal(isAllowedMediaRedirectHost('127.0.0.1'), false);
  assert.equal(isAllowedMediaRedirectHost('169.254.169.254'), false);
  assert.equal(isAllowedMediaRedirectHost('localhost'), false);
  assert.equal(isAllowedMediaRedirectHost('evil.example.com'), false);
});

test('detectAudioMagicFormat accepts real ID3 MP3, MPEG sync, WAV, FLAC and rejects HTML/empty', () => {
  const id3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);
  assert.deepEqual(detectAudioMagicFormat(id3, 'audio/mpeg'), {
    valid: true,
    format: 'mp3',
    mimeType: 'audio/mpeg',
    extension: 'mp3',
  });

  const mpegSync = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
  assert.equal(detectAudioMagicFormat(mpegSync, 'application/octet-stream').format, 'mp3');

  const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
  assert.equal(detectAudioMagicFormat(wav, 'audio/wav').format, 'wav');

  const flac = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00]);
  assert.equal(detectAudioMagicFormat(flac, 'audio/flac').format, 'flac');

  const html = new TextEncoder().encode('<!doctype html><html><body>Login</body></html>');
  assert.equal(detectAudioMagicFormat(html, 'audio/mpeg').valid, false);

  assert.equal(detectAudioMagicFormat(new Uint8Array([]), 'audio/mpeg').valid, false);
});

test('sanitizeDownloadFilename preserves Persian title and creates safe ASCII fallback', () => {
  const result = sanitizeDownloadFilename('رؤیای خاک‌خورده / تست*', 'a3pxxki7ikq8', 'mp3');
  assert.equal(result.utf8Filename, 'رؤیای خاک‌خورده تست.mp3');
  assert.equal(result.asciiFallback, 'ace-music-a3pxxki7ikq8.mp3');
});
