export type AudioFormat = 'FLAC' | 'ALAC' | 'WAV' | 'AIFF' | 'DSD' | 'MP3' | 'AAC' | 'OGG';

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
  sampleRate: number; // in Hz (e.g., 96000, 192000, 48000, 44100)
  bitDepth: number; // in bits (e.g., 24, 32, 16)
  channels: number; // e.g., 2
  bitrate: number; // in kbps (e.g., 2822, 1411, 320)
  genre: string;
  year?: number;
  bpm?: number;
  key?: string;
  coverArtUrl?: string;
  audioBlob?: Blob;
  audioUrl?: string; // blob URL or synthesized audio
  audioBuffer?: AudioBuffer;
  lyrics?: SyncedLyricLine[];
  rawLrc?: string;
  isFavorite?: boolean;
  playCount: number;
  dateAdded: number;
  isHiRes: boolean;
  filePath?: string;
  fileSize?: number;
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
}
