import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSynchsafeInt, embedId3v2Tags, stripExistingId3v2Header } from './id3.ts';

test('embedId3v2Tags writes valid ID3v2.3 header, Persian UTF-16 frames, lyrics, and APIC cover', () => {
  const rawAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02, 0x03]);
  const dummyCover = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22]);

  const tagged = embedId3v2Tags(rawAudio, {
    title: 'رؤیای خاک‌خورده',
    artist: 'زهرا سادات',
    album: 'ACE Music',
    lyricsText: 'متن آزمایشی آهنگ',
    cover: { bytes: dummyCover, mimeType: 'image/jpeg' },
  });

  // Starts with ID3v2.3.0
  assert.equal(String.fromCharCode(tagged[0], tagged[1], tagged[2]), 'ID3');
  assert.equal(tagged[3], 3);
  assert.equal(tagged[4], 0);

  const tagSize = decodeSynchsafeInt(tagged.subarray(6, 10));
  assert.equal(10 + tagSize + rawAudio.length, tagged.length);

  // Audio payload preserved identically at the end
  assert.deepEqual(tagged.subarray(10 + tagSize), rawAudio);

  // Required frame IDs exist inside tag section
  const tagAscii = Buffer.from(tagged.subarray(10, 10 + tagSize)).toString('latin1');
  assert.ok(tagAscii.includes('TIT2'));
  assert.ok(tagAscii.includes('TPE1'));
  assert.ok(tagAscii.includes('TALB'));
  assert.ok(tagAscii.includes('USLT'));
  assert.ok(tagAscii.includes('APIC'));
  assert.ok(tagAscii.includes('image/jpeg'));
});

test('stripExistingId3v2Header replaces old ID3v2 header cleanly without duplicating tags', () => {
  const rawAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0xaa, 0xbb]);
  const firstPass = embedId3v2Tags(rawAudio, { title: 'Old Title' });
  const secondPass = embedId3v2Tags(firstPass, { title: 'New Title', artist: 'Artist' });

  const stripped = stripExistingId3v2Header(secondPass);
  assert.deepEqual(stripped, rawAudio);
});
