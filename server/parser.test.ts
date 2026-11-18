import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSongFromHtml } from './parser.ts';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>رؤیای خاک‌خورده by zahra sadate yaghoobi | ACE Music</title>
  <meta property="og:title" content="رؤیای خاک‌خورده by zahra sadate yaghoobi | ACE Music" />
  <meta property="og:description" content="A song made with ACE Music — female vocal, pop, acoustic ballad" />
  <meta property="og:image" content="https://acemusic.ai/data/so_test-cover.jpg?v=123" />
  <meta property="og:audio" content="https://acemusic.ai/data/so_test.mp3" />
  <meta property="og:audio:type" content="audio/mpeg" />
</head>
<body>
  <main class="song-page" data-slug="a3pxxki7ikq8" data-state="ready" data-title="رؤیای خاک‌خورده" data-by="zahra sadate yaghoobi" data-cover="/data/so_test-cover.jpg?v=123" data-owner="false" data-paid="false" data-visibility="link" data-formats="mp3" data-free="mp3" data-model="ace-step-1.5-xl">
    <div class="sp-title"><h1>رؤیای خاک‌خورده</h1><span class="sp-model free" data-model="ace-step-1.5-xl">ACE-Step v1.5 XL</span></div>
    <p class="sp-meta"><span>zahra sadate yaghoobi<span class="sp-when"> · 2:12 · Nov 17, 2026</span></span></p>
    <p class="sp-style">female vocal, pop, acoustic ballad</p>
    <div class="sp-player">
      <div class="sp-times"><span class="sp-cur">0:00</span><span class="sp-dur">2:12</span></div>
      <audio preload="metadata" src="/data/so_test.mp3"></audio>
    </div>
    <section class="sp-lyrics"><div class="sp-sec"><h3>Verse</h3><p>سطر اول<br>سطر دوم</p></div></section>
  </main>
</body>
</html>`;

test('extractSongFromHtml parses real ACE Music song page attributes, audio, OG, and lyrics', () => {
  const parsed = extractSongFromHtml(
    SAMPLE_HTML,
    'https://acemusic.ai/song/a3pxxki7ikq8?sh=P0gf84B8iyj',
    'a3pxxki7ikq8'
  );
  assert.equal(parsed.songId, 'a3pxxki7ikq8');
  assert.equal(parsed.title, 'رؤیای خاک‌خورده');
  assert.equal(parsed.creator, 'zahra sadate yaghoobi');
  assert.equal(parsed.durationText, '2:12');
  assert.equal(parsed.durationSeconds, 132);
  assert.equal(parsed.modelKey, 'ace-step-1.5-xl');
  assert.equal(parsed.modelName, 'ACE-Step v1.5 XL');
  assert.equal(parsed.audioUrl, 'https://acemusic.ai/data/so_test.mp3');
  assert.equal(parsed.coverUrl, 'https://acemusic.ai/data/so_test-cover.jpg?v=123');
  assert.equal(parsed.inferredFormat, 'mp3');
  assert.equal(parsed.requiresSubscription, false);
  assert.deepEqual(parsed.lyrics, [{ heading: 'Verse', lines: ['سطر اول', 'سطر دوم'] }]);
});

test('extractSongFromHtml detects subscription-gated song without free audio', () => {
  const gatedHtml = `<!doctype html><html><body>
    <main class="song-page" data-slug="locked123" data-state="ready" data-title="Track Pro" data-by="Artist" data-paid="false" data-visibility="link" data-formats="mp3 wav" data-free="" data-model="ace-music-v1.1-preview">
      <div class="sp-title"><h1>Track Pro</h1><span class="sp-model">ACE Music v1.1 Preview</span></div>
    </main>
  </body></html>`;

  const parsed = extractSongFromHtml(gatedHtml, 'https://acemusic.ai/song/locked123', 'locked123');
  assert.equal(parsed.modelKey, 'ace-music-v1.1-preview');
  assert.equal(parsed.audioUrl, null);
  assert.equal(parsed.requiresSubscription, true);
});

test('extractSongFromHtml supports JSON-LD fallback and non-MP3 format notice', () => {
  const jsonLdHtml = `<!doctype html><html><head>
    <script type="application/ld+json">
      {"@type":"MusicRecording","name":"Ambient Dawn","byArtist":{"name":"Studio"},"duration":"PT1M45S","audio":{"contentUrl":"https://acemusic.ai/data/dawn.wav","encodingFormat":"audio/wav"}}
    </script>
  </head><body></body></html>`;

  const parsed = extractSongFromHtml(jsonLdHtml, 'https://acemusic.ai/song/dawn999', 'dawn999');
  assert.equal(parsed.title, 'Ambient Dawn');
  assert.equal(parsed.creator, 'Studio');
  assert.equal(parsed.durationText, '1:45');
  assert.equal(parsed.audioUrl, 'https://acemusic.ai/data/dawn.wav');
  assert.equal(parsed.inferredFormat, 'wav');
});
