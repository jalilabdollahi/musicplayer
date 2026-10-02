export type AudioFormat =
  | 'FLAC'
  | 'ALAC'
  | 'WAV'
  | 'AIFF'
  | 'DSD'
  | 'MP3'
  | 'AAC'
  | 'M4A'
  | 'OGG'
  | 'OPUS';

export interface SyncedLyricLine {
  id: string;
  time: number; // in seconds
  text: string;
  translation?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  format: AudioFormat;
  /** Hz; 0 when the file header could not be read. */
  sampleRate: number;
  /** Bits; 0 when unknown (always unknown for lossy formats). */
  bitDepth: number;
  channels: number;
  /** kbps; for lossy files this is the average over the whole file. */
  bitrate: number;
  genre: string;
  year?: number;
  trackNo?: number;
  bpm?: number;
  key?: string;
  /** Runtime object URL for the artwork. Never persisted. */
  coverArtUrl?: string;
  /** Embedded artwork, persisted alongside the track record. */
  coverArtBlob?: Blob;
  /** Audio bytes for imported tracks. Lives in its own store, hydrated on play. */
  audioBlob?: Blob;
  audioUrl?: string;
  lyrics?: SyncedLyricLine[];
  rawLrc?: string;
  isFavorite?: boolean;
  playCount: number;
  dateAdded: number;
  isHiRes: boolean;
  filePath?: string;
  fileSize?: number;
  /**
   * Where the audio comes from. Imported tracks are copied into IndexedDB;
   * folder tracks are read from a linked directory on every play.
   */
  source?: 'imported' | 'folder';
  folderId?: string;
  /** Path inside the linked folder, '/'-separated. */
  relPath?: string;
  /** File lastModified at scan time, used to spot changed files on rescan. */
  fileModified?: number;
}

/** A directory linked through the File System Access API. */
export interface LinkedFolder {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  addedAt: number;
  lastScanAt?: number;
  /** Files the user removed from the library; rescans skip them. */
  excluded?: string[];
}

export interface SmartPlaylistRule {
  formats?: AudioFormat[];
  onlyHiRes?: boolean;
  minBitDepth?: number;
  minSampleRate?: number;
  minBitrate?: number;
  genres?: string[];
  minBpm?: number;
  maxBpm?: number;
  onlyFavorites?: boolean;
  minPlayCount?: number;
  searchQuery?: string;
  sortBy: 'dateAdded' | 'playCount' | 'title' | 'artist' | 'duration' | 'sampleRate' | 'bitrate' | 'bpm';
  sortOrder: 'asc' | 'desc';
  limit?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  isSmart: boolean;
  icon?: string;
  rule?: SmartPlaylistRule;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  coverGradient?: string;
}

export interface EQBand {
  freq: number;
  label: string;
  gain: number; // -12dB to +12dB
}

export interface EQPreset {
  id: string;
  name: string;
  gains: number[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export type VisualizerMode = 'spectrum' | 'waveform' | 'circular';

export interface AudioEngineSettings {
  volume: number;
  isMuted: boolean;
  preampGain: number; // -12 to +12 dB
  eqGains: number[];
  isEqEnabled: boolean;
  isSpatialAudioEnabled: boolean;
  spatialStereoWidth: number; // 0 to 2 (1 = normal)
  visualizerMode: VisualizerMode;
  /** 1 = normal speed. Pitch is preserved at other rates. */
  playbackRate: number;
}
