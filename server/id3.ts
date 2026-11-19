export interface Id3CoverInput {
  bytes: Uint8Array;
  mimeType: string;
}

export interface Id3TagMetadata {
  title: string;
  artist?: string | null;
  album?: string | null;
  lyricsText?: string | null;
  cover?: Id3CoverInput | null;
}

function encodeSynchsafeInt(value: number): Uint8Array {
  const safe = Math.max(0, Math.floor(value));
  return new Uint8Array([
    (safe >> 21) & 0x7f,
    (safe >> 14) & 0x7f,
    (safe >> 7) & 0x7f,
    safe & 0x7f,
  ]);
}

export function decodeSynchsafeInt(bytes: Uint8Array): number {
  if (bytes.length < 4) return 0;
  return (
    ((bytes[0] & 0x7f) << 21) |
    ((bytes[1] & 0x7f) << 14) |
    ((bytes[2] & 0x7f) << 7) |
    (bytes[3] & 0x7f)
  );
}

function encodeUint32BE(value: number): Uint8Array {
  const safe = Math.max(0, Math.floor(value));
  return new Uint8Array([
    (safe >>> 24) & 0xff,
    (safe >>> 16) & 0xff,
    (safe >>> 8) & 0xff,
    safe & 0xff,
  ]);
}

function encodeAscii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i) & 0x7f;
  }
  return out;
}

function encodeUtf16LeWithBom(text: string): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return out;
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.byteLength;
  }
  return result;
}

function buildFrame(frameId: string, payload: Uint8Array): Uint8Array {
  const idBytes = encodeAscii(frameId.slice(0, 4).padEnd(4, ' '));
  const sizeBytes = encodeUint32BE(payload.byteLength);
  const flags = new Uint8Array([0x00, 0x00]);
  return concatUint8Arrays([idBytes, sizeBytes, flags, payload]);
}

function buildTextFrame(frameId: string, value: string): Uint8Array {
  const encoding = new Uint8Array([0x01]); // UTF-16 with BOM
  const encodedText = encodeUtf16LeWithBom(value);
  return buildFrame(frameId, concatUint8Arrays([encoding, encodedText]));
}

function buildLyricsFrame(lyricsText: string): Uint8Array {
  const encoding = new Uint8Array([0x01]); // UTF-16 with BOM
  const lang = encodeAscii('eng');
  const emptyDesc = new Uint8Array([0xff, 0xfe, 0x00, 0x00]); // UTF-16LE BOM + NUL terminator
  const encodedLyrics = encodeUtf16LeWithBom(lyricsText);
  return buildFrame(
    'USLT',
    concatUint8Arrays([encoding, lang, emptyDesc, encodedLyrics])
  );
}

function buildApicFrame(cover: Id3CoverInput): Uint8Array {
  const cleanMime = (cover.mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
  const encoding = new Uint8Array([0x00]); // ISO-8859-1 for MIME & empty description
  const mimeBytes = encodeAscii(cleanMime);
  const nul = new Uint8Array([0x00]);
  const pictureType = new Uint8Array([0x03]); // Cover (front)
  const payload = concatUint8Arrays([
    encoding,
    mimeBytes,
    nul,
    pictureType,
    nul,
    cover.bytes,
  ]);
  return buildFrame('APIC', payload);
}

export function stripExistingId3v2Header(mp3Bytes: Uint8Array): Uint8Array {
  if (
    mp3Bytes.length >= 10 &&
    mp3Bytes[0] === 0x49 &&
    mp3Bytes[1] === 0x44 &&
    mp3Bytes[2] === 0x33 &&
    mp3Bytes[3] < 0xff &&
    mp3Bytes[4] < 0xff &&
    mp3Bytes[6] < 0x80 &&
    mp3Bytes[7] < 0x80 &&
    mp3Bytes[8] < 0x80 &&
    mp3Bytes[9] < 0x80
  ) {
    const tagSize = decodeSynchsafeInt(mp3Bytes.subarray(6, 10));
    const hasFooter = (mp3Bytes[5] & 0x10) !== 0;
    const totalTagBytes = 10 + tagSize + (hasFooter ? 10 : 0);
    if (totalTagBytes < mp3Bytes.length) {
      return mp3Bytes.subarray(totalTagBytes);
    }
  }
  return mp3Bytes;
}

export function embedId3v2Tags(mp3Bytes: Uint8Array, meta: Id3TagMetadata): Uint8Array {
  const frames: Uint8Array[] = [];

  const title = meta.title.trim();
  if (title) {
    frames.push(buildTextFrame('TIT2', title));
  }

  const artist = meta.artist?.trim();
  if (artist) {
    frames.push(buildTextFrame('TPE1', artist));
  }

  const album = meta.album?.trim() || 'ACE Music';
  frames.push(buildTextFrame('TALB', album));

  const lyrics = meta.lyricsText?.trim();
  if (lyrics) {
    frames.push(buildLyricsFrame(lyrics));
  }

  if (meta.cover && meta.cover.bytes.byteLength > 0) {
    frames.push(buildApicFrame(meta.cover));
  }

  if (frames.length === 0) {
    return mp3Bytes;
  }

  const framesBuffer = concatUint8Arrays(frames);
  const header = concatUint8Arrays([
    encodeAscii('ID3'),
    new Uint8Array([0x03, 0x00, 0x00]), // ID3v2.3.0, flags = 0
    encodeSynchsafeInt(framesBuffer.byteLength),
  ]);

  const audioFramesOnly = stripExistingId3v2Header(mp3Bytes);
  return concatUint8Arrays([header, framesBuffer, audioFramesOnly]);
}
