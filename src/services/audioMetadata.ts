import { AudioFormat, Track } from '../types/music';

/**
 * Reads tags and stream properties straight from the file's bytes, for every
 * format the player accepts. Anything a file does not declare stays unknown
 * (0 / undefined) rather than being guessed: the UI hides unknown fields.
 */

export const AUDIO_EXTENSIONS = [
  'mp3', 'flac', 'wav', 'wave', 'aif', 'aiff', 'aifc', 'm4a', 'mp4', 'aac',
  'alac', 'ogg', 'oga', 'opus', 'dsf', 'dff', 'webm', 'weba',
];

export function isAudioFileName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.includes(ext);
}

export function isLyricsFileName(name: string): boolean {
  return /\.lrc$/i.test(name);
}

const LOSSLESS: AudioFormat[] = ['FLAC', 'ALAC', 'WAV', 'AIFF', 'DSD'];

export function isLosslessFormat(format: AudioFormat): boolean {
  return LOSSLESS.includes(format);
}

interface Tags {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  genre?: string;
  year?: number;
  trackNo?: number;
  bpm?: number;
  cover?: Blob;
}

interface Stream {
  format?: AudioFormat;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  duration?: number;
}

const MAX_TAG_BYTES = 16 * 1024 * 1024;

async function readBytes(file: Blob, start: number, length: number): Promise<Uint8Array> {
  const end = Math.min(file.size, start + length);
  if (start >= end) return new Uint8Array(0);
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let s = '';
  for (let i = start; i < start + length && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const synchsafe = (b: Uint8Array, o: number) =>
  ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

/**
 * Decodes legacy 8-bit tag text. Valid UTF-8 wins; otherwise Arabic-script
 * byte patterns pick Windows-1256 (common for Persian rips), else Latin-1.
 */
function decodeLegacy(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    let high = 0;
    let arabic = 0;
    for (const b of bytes) {
      if (b < 0x80) continue;
      high++;
      if ((b >= 0xc1 && b <= 0xdf && b !== 0xd7) || b === 0xe1 || (b >= 0xe3 && b <= 0xe6) || b === 0xec || b === 0xed) {
        arabic++;
      }
    }
    const label = high > 0 && arabic / high > 0.6 ? 'windows-1256' : 'windows-1252';
    return new TextDecoder(label).decode(bytes);
  }
}

function clean(text: string | undefined): string | undefined {
  const value = text?.split('\0')[0].trim();
  return value ? value : undefined;
}

function parseLeadingInt(text: string | undefined): number | undefined {
  const n = parseInt(text ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ---------------------------------------------------------------- ID3v2

function decodeId3Text(encoding: number, bytes: Uint8Array): string {
  if (encoding === 1) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (encoding === 2) return new TextDecoder('utf-16be').decode(bytes);
  if (encoding === 3) return new TextDecoder('utf-8').decode(bytes);
  return decodeLegacy(bytes);
}

/** Index just past the null terminator for the given ID3 text encoding. */
function skipTerminated(bytes: Uint8Array, start: number, encoding: number): number {
  const wide = encoding === 1 || encoding === 2;
  let i = start;
  if (wide) {
    while (i + 1 < bytes.length && !(bytes[i] === 0 && bytes[i + 1] === 0)) i += 2;
    return i + 2;
  }
  while (i < bytes.length && bytes[i] !== 0) i++;
  return i + 1;
}

function parseId3(tag: Uint8Array): Tags {
  const version = tag[3];
  const flags = tag[5];
  const end = Math.min(tag.length, 10 + synchsafe(tag, 6));
  let pos = 10;

  if (flags & 0x40) {
    // Extended header: v2.4 size is synchsafe and includes itself.
    pos += version === 4 ? synchsafe(tag, 10) : u32be(tag, 10) + 4;
  }

  const raw: Record<string, string> = {};
  let cover: Blob | undefined;
  const v22 = version === 2;
  const headerLen = v22 ? 6 : 10;

  while (pos + headerLen < end) {
    const id = ascii(tag, pos, v22 ? 3 : 4);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const size = v22
      ? (tag[pos + 3] << 16) | (tag[pos + 4] << 8) | tag[pos + 5]
      : version === 4
        ? synchsafe(tag, pos + 4)
        : u32be(tag, pos + 4);
    if (size <= 0 || pos + headerLen + size > end) break;
    const data = tag.subarray(pos + headerLen, pos + headerLen + size);

    if ((id === 'APIC' || id === 'PIC') && !cover) {
      const encoding = data[0];
      let mime = 'image/jpeg';
      let p: number;
      if (v22) {
        if (ascii(data, 1, 3).toUpperCase() === 'PNG') mime = 'image/png';
        p = 4;
      } else {
        const mimeEnd = data.indexOf(0, 1);
        mime = ascii(data, 1, mimeEnd - 1) || mime;
        if (!mime.includes('/')) mime = `image/${mime.toLowerCase()}`;
        p = mimeEnd + 1;
      }
      p = skipTerminated(data, p + 1, encoding); // picture type, then description
      if (data.length - p > 64) cover = new Blob([data.slice(p)], { type: mime });
    } else if (id[0] === 'T' && id !== 'TXXX' && id !== 'TXX') {
      raw[id] = decodeId3Text(data[0], data.subarray(1));
    }

    pos += headerLen + size;
  }

  const pick = (a: string, b: string) => clean(raw[a] ?? raw[b]);
  let genre = pick('TCON', 'TCO');
  // ID3v1 genre references like "(17)" or "17" carry no readable name.
  if (genre && /^\(?\d+\)?$/.test(genre)) genre = undefined;

  return {
    title: pick('TIT2', 'TT2'),
    artist: pick('TPE1', 'TP1'),
    albumArtist: pick('TPE2', 'TP2'),
    album: pick('TALB', 'TAL'),
    genre,
    year: parseLeadingInt(pick('TDRC', 'TYE') ?? clean(raw['TYER'])),
    trackNo: parseLeadingInt(pick('TRCK', 'TRK')),
    bpm: parseLeadingInt(pick('TBPM', 'TBP')),
    cover,
  };
}

async function readId3At(file: Blob, offset: number): Promise<{ tags: Tags; size: number } | null> {
  const head = await readBytes(file, offset, 10);
  if (ascii(head, 0, 3) !== 'ID3') return null;
  const size = 10 + synchsafe(head, 6) + (head[5] & 0x10 ? 10 : 0);
  const tag = await readBytes(file, offset, Math.min(size, MAX_TAG_BYTES));
  return { tags: parseId3(tag), size };
}

// ---------------------------------------------------------------- Vorbis comments (FLAC / Ogg)

function parseVorbisComments(bytes: Uint8Array, offset: number, tags: Tags): void {
  const utf8 = new TextDecoder('utf-8');
  let p = offset;
  p += 4 + u32le(bytes, p); // vendor string
  const count = u32le(bytes, p);
  p += 4;
  for (let i = 0; i < count && p + 4 <= bytes.length; i++) {
    const len = u32le(bytes, p);
    p += 4;
    const entry = utf8.decode(bytes.subarray(p, p + len));
    p += len;
    const eq = entry.indexOf('=');
    if (eq < 0) continue;
    const key = entry.slice(0, eq).toUpperCase();
    const value = entry.slice(eq + 1).trim();
    if (!value) continue;
    if (key === 'TITLE') tags.title ??= value;
    else if (key === 'ARTIST') tags.artist ??= value;
    else if (key === 'ALBUMARTIST' || key === 'ALBUM ARTIST') tags.albumArtist ??= value;
    else if (key === 'ALBUM') tags.album ??= value;
    else if (key === 'GENRE') tags.genre ??= value;
    else if (key === 'DATE' || key === 'YEAR') tags.year ??= parseLeadingInt(value);
    else if (key === 'TRACKNUMBER') tags.trackNo ??= parseLeadingInt(value);
    else if (key === 'BPM') tags.bpm ??= parseLeadingInt(value);
    else if (key === 'METADATA_BLOCK_PICTURE' && !tags.cover) {
      try {
        const bin = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
        tags.cover = parseFlacPicture(bin);
      } catch {
        // Malformed base64 picture; ignore it.
      }
    }
  }
}

function parseFlacPicture(b: Uint8Array): Blob | undefined {
  let p = 4; // picture type
  const mimeLen = u32be(b, p);
  const mime = ascii(b, p + 4, mimeLen) || 'image/jpeg';
  p += 4 + mimeLen;
  p += 4 + u32be(b, p); // description
  p += 16; // width, height, depth, colours
  const len = u32be(b, p);
  p += 4;
  return len > 64 ? new Blob([b.slice(p, p + len)], { type: mime }) : undefined;
}

// ---------------------------------------------------------------- FLAC

async function parseFlac(file: Blob, start: number, tags: Tags, stream: Stream): Promise<void> {
  stream.format = 'FLAC';
  let pos = start + 4;
  for (let guard = 0; guard < 64; guard++) {
    const header = await readBytes(file, pos, 4);
    if (header.length < 4) break;
    const last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const len = (header[1] << 16) | (header[2] << 8) | header[3];

    if (type === 0) {
      const b = await readBytes(file, pos + 4, 18);
      stream.sampleRate = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
      stream.channels = ((b[12] >> 1) & 0x07) + 1;
      stream.bitDepth = (((b[12] & 0x01) << 4) | (b[13] >> 4)) + 1;
      const totalSamples = (b[13] & 0x0f) * 2 ** 32 + u32be(b, 14);
      if (totalSamples > 0 && stream.sampleRate > 0) stream.duration = totalSamples / stream.sampleRate;
    } else if (type === 4 && len < MAX_TAG_BYTES) {
      parseVorbisComments(await readBytes(file, pos + 4, len), 0, tags);
    } else if (type === 6 && !tags.cover && len < MAX_TAG_BYTES) {
      tags.cover = parseFlacPicture(await readBytes(file, pos + 4, len));
    }

    pos += 4 + len;
    if (last) break;
  }
}

// ---------------------------------------------------------------- Ogg (Vorbis / Opus)

async function parseOgg(file: Blob, tags: Tags, stream: Stream): Promise<void> {
  // Reassemble the first few packets from their pages so a comment header
  // that spans pages (embedded art) still parses.
  const bytes = await readBytes(file, 0, 4 * 1024 * 1024);
  const packets: Uint8Array[] = [];
  let current: number[] = [];
  let p = 0;
  while (p + 27 < bytes.length && packets.length < 2 && ascii(bytes, p, 4) === 'OggS') {
    const segments = bytes[p + 26];
    const table = bytes.subarray(p + 27, p + 27 + segments);
    let body = p + 27 + segments;
    for (const lacing of table) {
      for (let i = 0; i < lacing; i++) current.push(bytes[body + i]);
      body += lacing;
      if (lacing < 255) {
        packets.push(Uint8Array.from(current));
        current = [];
        if (packets.length === 2) break;
      }
    }
    p = body;
  }

  const [id, comments] = packets;
  if (id && ascii(id, 0, 8) === 'OpusHead') {
    stream.format = 'OPUS';
    stream.channels = id[9];
    stream.sampleRate = 48000; // Opus always decodes at 48 kHz.
  } else if (id && ascii(id, 1, 6) === 'vorbis') {
    stream.format = 'OGG';
    stream.channels = id[11];
    stream.sampleRate = u32le(id, 12);
  }
  if (comments) {
    if (ascii(comments, 0, 8) === 'OpusTags') parseVorbisComments(comments, 8, tags);
    else if (ascii(comments, 1, 6) === 'vorbis') parseVorbisComments(comments, 7, tags);
  }
}

// ---------------------------------------------------------------- MP4 / M4A

interface Atom {
  type: string;
  start: number; // payload start (absolute)
  end: number;
}

function childAtoms(b: Uint8Array, start: number, end: number, base: number): Atom[] {
  const atoms: Atom[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32be(b, p);
    const type = ascii(b, p + 4, 4);
    let header = 8;
    if (size === 1) {
      size = u32be(b, p + 8) * 2 ** 32 + u32be(b, p + 12);
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header) break;
    atoms.push({ type, start: base + p + header, end: base + Math.min(end, p + size) });
    p += size;
  }
  return atoms;
}

async function parseMp4(file: Blob, tags: Tags, stream: Stream): Promise<void> {
  // Walk the top-level atoms by header only; moov may sit after the media.
  let pos = 0;
  let moov: Uint8Array | null = null;
  for (let guard = 0; guard < 32 && pos + 8 <= file.size; guard++) {
    const h = await readBytes(file, pos, 16);
    let size = u32be(h, 0);
    const type = ascii(h, 4, 4);
    let header = 8;
    if (size === 1) {
      size = u32be(h, 8) * 2 ** 32 + u32be(h, 12);
      header = 16;
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < header) break;
    if (type === 'moov') {
      moov = await readBytes(file, pos + header, Math.min(size - header, MAX_TAG_BYTES));
      break;
    }
    pos += size;
  }
  if (!moov) return;

  const find = (atoms: Atom[], type: string) => atoms.find((a) => a.type === type);
  const kids = (a: Atom | undefined, skip = 0) => (a ? childAtoms(moov!, a.start + skip, a.end, 0) : []);
  const top = childAtoms(moov, 0, moov.length, 0);

  // Duration from mvhd.
  const mvhd = find(top, 'mvhd');
  if (mvhd) {
    const v = moov[mvhd.start];
    const scale = v === 1 ? u32be(moov, mvhd.start + 20) : u32be(moov, mvhd.start + 12);
    const dur = v === 1 ? u32be(moov, mvhd.start + 24) * 2 ** 32 + u32be(moov, mvhd.start + 28) : u32be(moov, mvhd.start + 16);
    if (scale > 0) stream.duration = dur / scale;
  }

  // Codec, channels, sample size and rate from the first audio sample entry.
  for (const trak of top.filter((a) => a.type === 'trak')) {
    const stsd = find(kids(find(kids(find(kids(find(kids(trak), 'mdia')), 'minf')), 'stbl')), 'stsd');
    if (!stsd) continue;
    const entry = childAtoms(moov, stsd.start + 8, stsd.end, 0)[0];
    if (!entry || (entry.type !== 'alac' && entry.type !== 'mp4a')) continue;
    const e = entry.start;
    stream.format = entry.type === 'alac' ? 'ALAC' : 'AAC';
    stream.channels = u16be(moov, e + 16);
    if (entry.type === 'alac') stream.bitDepth = u16be(moov, e + 18);
    stream.sampleRate = u16be(moov, e + 24);
    // The 16.16 rate field overflows above 65535 Hz; the ALAC cookie has it exact.
    const cookie = find(childAtoms(moov, e + 28, entry.end, 0), 'alac');
    if (cookie) {
      stream.bitDepth = moov[cookie.start + 9];
      stream.channels = moov[cookie.start + 13];
      stream.sampleRate = u32be(moov, cookie.start + 24);
    }
    break;
  }

  const meta = find(kids(find(top, 'udta')), 'meta');
  const ilst = find(kids(meta, 4), 'ilst');
  const utf8 = new TextDecoder('utf-8');
  for (const item of kids(ilst)) {
    const data = find(kids(item), 'data');
    if (!data) continue;
    const payload = moov.subarray(data.start + 8, data.end);
    const text = () => clean(utf8.decode(payload));
    switch (item.type) {
      case '©nam': tags.title ??= text(); break;
      case '©ART': tags.artist ??= text(); break;
      case 'aART': tags.albumArtist ??= text(); break;
      case '©alb': tags.album ??= text(); break;
      case '©gen': tags.genre ??= text(); break;
      case '©day': tags.year ??= parseLeadingInt(text()); break;
      case 'trkn': tags.trackNo ??= payload.length >= 4 ? u16be(payload, 2) || undefined : undefined; break;
      case 'tmpo': tags.bpm ??= payload.length >= 2 ? u16be(payload, 0) || undefined : undefined; break;
      case 'covr':
        if (!tags.cover && payload.length > 64) {
          const png = payload[0] === 0x89 && payload[1] === 0x50;
          tags.cover = new Blob([payload.slice()], { type: png ? 'image/png' : 'image/jpeg' });
        }
        break;
    }
  }
}

// ---------------------------------------------------------------- RIFF / AIFF / DSF / MPEG

const INFO_KEYS: Record<string, keyof Tags> = { INAM: 'title', IART: 'artist', IPRD: 'album', IGNR: 'genre' };

async function parseWav(file: Blob, tags: Tags, stream: Stream): Promise<void> {
  stream.format = 'WAV';
  let pos = 12;
  let byteRate = 0;
  for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
    const h = await readBytes(file, pos, 8);
    const id = ascii(h, 0, 4);
    const size = u32le(h, 4);
    if (id === 'fmt ') {
      const f = await readBytes(file, pos + 8, 16);
      stream.channels = u16le(f, 2);
      stream.sampleRate = u32le(f, 4);
      byteRate = u32le(f, 8);
      stream.bitDepth = u16le(f, 14);
    } else if (id === 'data') {
      if (byteRate > 0) stream.duration = size / byteRate;
    } else if (id === 'LIST' && size < MAX_TAG_BYTES) {
      const list = await readBytes(file, pos + 8, size);
      if (ascii(list, 0, 4) === 'INFO') {
        let p = 4;
        while (p + 8 <= list.length) {
          const key = ascii(list, p, 4);
          const len = u32le(list, p + 4);
          const field = INFO_KEYS[key];
          if (field) (tags as Record<string, unknown>)[field] ??= clean(decodeLegacy(list.subarray(p + 8, p + 8 + len)));
          p += 8 + len + (len & 1);
        }
      }
    } else if ((id === 'id3 ' || id === 'ID3 ') && !tags.title) {
      const found = await readId3At(file, pos + 8);
      if (found) Object.assign(tags, { ...found.tags, ...stripUndefined(tags) });
    }
    pos += 8 + size + (size & 1);
  }
}

/** 80-bit IEEE 754 extended float, as used by AIFF's COMM chunk. */
function readExtended(b: Uint8Array, o: number): number {
  const exponent = ((b[o] & 0x7f) << 8) | b[o + 1];
  const mantissa = u32be(b, o + 2) * 2 ** 32 + u32be(b, o + 6);
  if (exponent === 0 && mantissa === 0) return 0;
  return mantissa * 2 ** (exponent - 16383 - 63);
}

async function parseAiff(file: Blob, tags: Tags, stream: Stream): Promise<void> {
  stream.format = 'AIFF';
  let pos = 12;
  for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
    const h = await readBytes(file, pos, 8);
    const id = ascii(h, 0, 4);
    const size = u32be(h, 4);
    if (id === 'COMM') {
      const c = await readBytes(file, pos + 8, 18);
      stream.channels = u16be(c, 0);
      const frames = u32be(c, 2);
      stream.bitDepth = u16be(c, 6);
      stream.sampleRate = Math.round(readExtended(c, 8));
      if (stream.sampleRate > 0) stream.duration = frames / stream.sampleRate;
    } else if (id === 'ID3 ' || id === 'id3 ') {
      const found = await readId3At(file, pos + 8);
      if (found) Object.assign(tags, { ...found.tags, ...stripUndefined(tags) });
    }
    pos += 8 + size + (size & 1);
  }
}

async function parseDsf(file: Blob, tags: Tags, stream: Stream): Promise<void> {
  stream.format = 'DSD';
  const h = await readBytes(file, 0, 92);
  const metaOffset = u32le(h, 20) + u32le(h, 24) * 2 ** 32;
  if (ascii(h, 28, 4) === 'fmt ') {
    stream.channels = u32le(h, 52);
    stream.sampleRate = u32le(h, 56);
    stream.bitDepth = 1;
    const samples = u32le(h, 64) + u32le(h, 68) * 2 ** 32;
    if (stream.sampleRate > 0) stream.duration = samples / stream.sampleRate;
  }
  if (metaOffset > 0) {
    const found = await readId3At(file, metaOffset);
    if (found) Object.assign(tags, found.tags);
  }
}

const MPEG_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

async function parseMpeg(file: Blob, start: number, stream: Stream): Promise<void> {
  const b = await readBytes(file, start, 64 * 1024);
  for (let i = 0; i + 4 < b.length; i++) {
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
    const version = (b[i + 1] >> 3) & 0x03;
    const layer = (b[i + 1] >> 1) & 0x03;
    const rateIndex = (b[i + 2] >> 2) & 0x03;
    if (version === 1 || layer === 0 || rateIndex === 3) continue;
    stream.format = 'MP3';
    stream.sampleRate = MPEG_RATES[version][rateIndex];
    stream.channels = ((b[i + 3] >> 6) & 0x03) === 3 ? 1 : 2;
    return;
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ---------------------------------------------------------------- Fallbacks

const EXTENSION_FORMATS: Record<string, AudioFormat> = {
  mp3: 'MP3', flac: 'FLAC', wav: 'WAV', wave: 'WAV', aif: 'AIFF', aiff: 'AIFF', aifc: 'AIFF',
  m4a: 'M4A', mp4: 'M4A', aac: 'AAC', alac: 'ALAC', ogg: 'OGG', oga: 'OGG', opus: 'OPUS',
  dsf: 'DSD', dff: 'DSD', webm: 'OPUS', weba: 'OPUS',
};

/** Media-element duration, for formats whose headers do not state it. */
function probeDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const finish = (value: number) => {
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) ? value : 0);
    };
    const timer = setTimeout(() => finish(0), 5000);
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

/** "03 - Artist - Title" → { artist, title }. */
function fromFileName(name: string): { title: string; artist?: string; trackNo?: number } {
  let base = name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
  let trackNo: number | undefined;
  const numbered = base.match(/^(\d{1,3})[\s.\-_)]+(.+)$/);
  if (numbered) {
    trackNo = parseInt(numbered[1], 10);
    base = numbered[2];
  }
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), trackNo };
  return { title: base, trackNo };
}

// ---------------------------------------------------------------- Entry point

/**
 * @param relPath Path within a linked or imported folder. Its parent folders
 *   stand in for missing album / artist tags (Artist/Album/01 Song.flac).
 */
export async function parseAudioFile(file: File, relPath?: string): Promise<Partial<Track>> {
  const tags: Tags = {};
  const stream: Stream = {};
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  try {
    const head = await readBytes(file, 0, 16);
    const magic = ascii(head, 0, 4);
    let audioStart = 0;

    if (ascii(head, 0, 3) === 'ID3') {
      const found = await readId3At(file, 0);
      if (found) {
        Object.assign(tags, found.tags);
        audioStart = found.size;
      }
    }

    const after = audioStart > 0 ? await readBytes(file, audioStart, 4) : head;
    const afterMagic = ascii(after, 0, 4);

    if (afterMagic === 'fLaC') await parseFlac(file, audioStart, tags, stream);
    else if (magic === 'RIFF' && ascii(head, 8, 4) === 'WAVE') await parseWav(file, tags, stream);
    else if (magic === 'FORM' && /^AIF[FC]$/.test(ascii(head, 8, 4))) await parseAiff(file, tags, stream);
    else if (magic === 'OggS') await parseOgg(file, tags, stream);
    else if (ascii(head, 4, 4) === 'ftyp') await parseMp4(file, tags, stream);
    else if (magic === 'DSD ') await parseDsf(file, tags, stream);
    else if (extension === 'mp3' || audioStart > 0) await parseMpeg(file, audioStart, stream);
  } catch (err) {
    console.warn('Could not read tags from', file.name, err);
  }

  const format = stream.format ?? EXTENSION_FORMATS[extension] ?? 'MP3';
  const duration = stream.duration && stream.duration > 0 ? stream.duration : await probeDuration(file);

  const named = fromFileName(file.name);
  const folders = (relPath ?? '').split('/').slice(0, -1).filter(Boolean);
  const folderAlbum = folders.length >= 1 ? folders[folders.length - 1] : undefined;
  const folderArtist = folders.length >= 2 ? folders[folders.length - 2] : undefined;

  const lossless = isLosslessFormat(format);
  const sampleRate = stream.sampleRate ?? 0;
  const bitDepth = lossless ? stream.bitDepth ?? 0 : 0;
  const channels = stream.channels ?? 0;
  const bitrate =
    lossless && sampleRate && bitDepth && channels && format !== 'FLAC' && format !== 'ALAC'
      ? Math.round((sampleRate * bitDepth * channels) / 1000)
      : duration > 0
        ? Math.round((file.size * 8) / duration / 1000)
        : 0;

  return {
    title: tags.title ?? named.title,
    artist: tags.artist ?? tags.albumArtist ?? named.artist ?? folderArtist ?? 'Unknown Artist',
    album: tags.album ?? folderAlbum ?? 'Unknown Album',
    genre: tags.genre ?? '',
    year: tags.year,
    trackNo: tags.trackNo ?? named.trackNo,
    bpm: tags.bpm,
    duration,
    format,
    sampleRate,
    bitDepth,
    channels,
    bitrate,
    coverArtBlob: tags.cover,
    isHiRes: format === 'DSD' || (lossless && (bitDepth > 16 || sampleRate > 48000)),
    fileSize: file.size,
    filePath: relPath ?? file.name,
  };
}
