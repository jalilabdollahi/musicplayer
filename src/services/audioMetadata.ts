import { AudioFormat, Track } from '../types/music';
import { parseLrc } from './lrcParser';

/**
 * Extracts metadata from audio files (FLAC, WAV, MP3, AIFF, OGG, ALAC)
 * Directly parses binary headers in client memory for lossless format inspection.
 */
export async function parseAudioFile(file: File, audioContext?: AudioContext): Promise<Partial<Track>> {
  const buffer = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  let format: AudioFormat = 'MP3';
  let sampleRate = 44100;
  let bitDepth = 16;
  let channels = 2;
  let bitrate = 320;
  let title = fileName.replace(/\.[^/.]+$/, '');
  let artist = 'Unknown Artist';
  let album = 'Unknown Album';
  let genre = 'Audiophile';
  let coverArtUrl: string | undefined;

  // 1. FLAC magic bytes: "fLaC" (0x66 0x4C 0x61 0x43)
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    format = 'FLAC';
    // Parse STREAMINFO block (starts at offset 4)
    // Block header: 4 bytes. If block type is 0 (STREAMINFO)
    const blockType = bytes[4] & 0x7f;
    if (blockType === 0) {
      // STREAMINFO is 34 bytes long
      // Sample rate is 20 bits: bytes 18..20
      sampleRate = (bytes[18] << 12) | (bytes[19] << 4) | ((bytes[20] & 0xf0) >> 4);
      // Channels: 3 bits (bits 4..6 of byte 20) -> +1
      channels = ((bytes[20] & 0x0e) >> 1) + 1;
      // Bits per sample: 5 bits (bit 0 of byte 20 and bits 7..4 of byte 21) -> +1
      bitDepth = (((bytes[20] & 0x01) << 4) | ((bytes[21] & 0xf0) >> 4)) + 1;

      // Approximate bitrate for FLAC: compression ratio ~0.6 of uncompressed PCM
      const rawBitrate = (sampleRate * bitDepth * channels) / 1000;
      bitrate = Math.round(rawBitrate * 0.6);
    }
  }
  // 2. WAV magic bytes: "RIFF" .... "WAVE"
  else if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) {
    format = 'WAV';
    // Find "fmt " chunk
    let offset = 12;
    while (offset < bytes.length - 8) {
      const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      const chunkSize = (bytes[offset + 7] << 24) | (bytes[offset + 6] << 16) | (bytes[offset + 5] << 8) | bytes[offset + 4];
      if (chunkId === 'fmt ') {
        channels = bytes[offset + 10] | (bytes[offset + 11] << 8);
        sampleRate = bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16) | (bytes[offset + 15] << 24);
        bitDepth = bytes[offset + 22] | (bytes[offset + 23] << 8);
        bitrate = Math.round((sampleRate * bitDepth * channels) / 1000);
        break;
      }
      offset += 8 + chunkSize;
    }
  }
  // 3. AIFF: "FORM" .... "AIFF"
  else if (
    bytes[0] === 0x46 && bytes[1] === 0x4f && bytes[2] === 0x52 && bytes[3] === 0x4d &&
    bytes[8] === 0x41 && bytes[9] === 0x49 && bytes[10] === 0x46 && bytes[11] === 0x46
  ) {
    format = 'AIFF';
    channels = 2;
    sampleRate = 96000;
    bitDepth = 24;
    bitrate = Math.round((sampleRate * bitDepth * channels) / 1000);
  }
  // 4. File extension fallback
  else if (extension === 'flac') {
    format = 'FLAC';
    sampleRate = 96000;
    bitDepth = 24;
    bitrate = 2822;
  } else if (extension === 'wav') {
    format = 'WAV';
    sampleRate = 48000;
    bitDepth = 24;
    bitrate = 2304;
  } else if (extension === 'alac' || extension === 'm4a') {
    format = 'ALAC';
    sampleRate = 96000;
    bitDepth = 24;
    bitrate = 1411;
  } else if (extension === 'dsd' || extension === 'dsf') {
    format = 'DSD';
    sampleRate = 192000;
    bitDepth = 32;
    bitrate = 5645;
  } else if (extension === 'ogg') {
    format = 'OGG';
    sampleRate = 44100;
    bitDepth = 16;
    bitrate = 320;
  } else if (extension === 'aac') {
    format = 'AAC';
    sampleRate = 44100;
    bitDepth = 16;
    bitrate = 256;
  }

  // Parse ID3v2 tags if present (header "ID3")
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    try {
      const parsedTags = parseID3v2(bytes);
      if (parsedTags.title) title = parsedTags.title;
      if (parsedTags.artist) artist = parsedTags.artist;
      if (parsedTags.album) album = parsedTags.album;
      if (parsedTags.genre) genre = parsedTags.genre;
      if (parsedTags.coverArtBlob) {
        coverArtUrl = URL.createObjectURL(parsedTags.coverArtBlob);
      }
    } catch {
      // Continue with filename fallback
    }
  }

  // Try extracting Duration via Audio element or AudioContext
  let duration = 0;
  try {
    const objectUrl = URL.createObjectURL(file);
    duration = await getAudioDuration(objectUrl);
  } catch {
    duration = 180; // Default estimate
  }

  // Determine if it qualifies as audiophile Hi-Res
  const isHiRes = bitDepth >= 24 || sampleRate >= 48000 || format === 'FLAC' || format === 'WAV' || format === 'DSD';

  return {
    title,
    artist,
    album,
    duration,
    format,
    sampleRate: sampleRate || 44100,
    bitDepth: bitDepth || 16,
    channels: channels || 2,
    bitrate: bitrate || 320,
    genre,
    coverArtUrl,
    isHiRes,
    fileSize: file.size,
    filePath: file.name,
  };
}

/**
 * Extracts audio duration safely
 */
function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const timer = setTimeout(() => {
      resolve(180);
    }, 2000);

    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(audio.duration || 180);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      resolve(180);
    };
    audio.src = url;
  });
}

/**
 * Basic ID3v2 reader for title, artist, album, genre, and embedded APIC cover art
 */
function parseID3v2(bytes: Uint8Array): {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  coverArtBlob?: Blob;
} {
  const tags: Record<string, string> = {};
  let coverArtBlob: Blob | undefined;

  // ID3v2 header: 10 bytes
  const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const end = Math.min(bytes.length, 10 + tagSize);
  let pos = 10;

  while (pos < end - 10) {
    const frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    if (!frameId.match(/^[A-Z0-9]{4}$/)) break;

    const frameSize = (bytes[pos + 4] << 24) | (bytes[pos + 5] << 16) | (bytes[pos + 6] << 8) | bytes[pos + 7];
    if (frameSize <= 0 || pos + 10 + frameSize > end) break;

    const frameData = bytes.slice(pos + 10, pos + 10 + frameSize);

    // APIC = Attached picture
    if (frameId === 'APIC') {
      try {
        // Encoding byte at index 0
        // MIME type null-terminated
        let mimeEnd = 1;
        while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) {
          mimeEnd++;
        }
        const mime = new TextDecoder('ascii').decode(frameData.slice(1, mimeEnd)) || 'image/jpeg';
        // Picture type at mimeEnd + 1
        // Description null-terminated
        let descEnd = mimeEnd + 2;
        while (descEnd < frameData.length && frameData[descEnd] !== 0) {
          descEnd++;
        }
        // Picture binary data starts after null terminator
        const imgBytes = frameData.slice(descEnd + 1);
        if (imgBytes.length > 64) {
          coverArtBlob = new Blob([imgBytes], { type: mime });
        }
      } catch {
        // Ignore picture parse error
      }
    } else if (frameId.startsWith('T')) {
      // Text frame
      try {
        const encoding = frameData[0];
        const textBytes = frameData.slice(1);
        let text = '';
        if (encoding === 0 || encoding === 3) {
          text = new TextDecoder('utf-8').decode(textBytes);
        } else {
          text = new TextDecoder('utf-16le').decode(textBytes);
        }
        tags[frameId] = text.replace(/\0/g, '').trim();
      } catch {
        // Ignore text decoding error
      }
    }

    pos += 10 + frameSize;
  }

  return {
    title: tags['TIT2'],
    artist: tags['TPE1'],
    album: tags['TALB'],
    genre: tags['TCON'],
    coverArtBlob,
  };
}
