import { Playlist, SmartPlaylistRule, Track } from '../types/music';

/**
 * Evaluates whether a track matches a smart playlist rule
 */
export function matchesSmartRule(track: Track, rule: SmartPlaylistRule): boolean {
  if (rule.onlyFavorites && !track.isFavorite) {
    return false;
  }

  if (rule.onlyHiRes && !track.isHiRes) {
    return false;
  }

  if (rule.formats && rule.formats.length > 0) {
    if (!rule.formats.includes(track.format)) {
      return false;
    }
  }

  if (rule.minBitDepth && track.bitDepth < rule.minBitDepth) {
    return false;
  }

  if (rule.minSampleRate && track.sampleRate < rule.minSampleRate) {
    return false;
  }

  if (rule.minBitrate && track.bitrate < rule.minBitrate) {
    return false;
  }

  if (rule.minBpm && (track.bpm === undefined || track.bpm < rule.minBpm)) {
    return false;
  }

  if (rule.maxBpm && (track.bpm === undefined || track.bpm > rule.maxBpm)) {
    return false;
  }

  if (rule.minPlayCount && track.playCount < rule.minPlayCount) {
    return false;
  }

  if (rule.genres && rule.genres.length > 0) {
    const trackGenreLower = track.genre.toLowerCase();
    const matchesAny = rule.genres.some((g) => trackGenreLower.includes(g.toLowerCase()));
    if (!matchesAny) return false;
  }

  if (rule.searchQuery) {
    const q = rule.searchQuery.toLowerCase();
    const matchesText =
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.album.toLowerCase().includes(q) ||
      track.genre.toLowerCase().includes(q);
    if (!matchesText) return false;
  }

  return true;
}

/**
 * Filter and sort tracks according to smart rule
 */
export function getTracksForSmartPlaylist(tracks: Track[], rule: SmartPlaylistRule): Track[] {
  const filtered = tracks.filter((t) => matchesSmartRule(t, rule));

  filtered.sort((a, b) => {
    let comparison = 0;
    switch (rule.sortBy) {
      case 'dateAdded':
        comparison = a.dateAdded - b.dateAdded;
        break;
      case 'playCount':
        comparison = a.playCount - b.playCount;
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'artist':
        comparison = a.artist.localeCompare(b.artist);
        break;
      case 'duration':
        comparison = a.duration - b.duration;
        break;
      case 'sampleRate':
        comparison = a.sampleRate - b.sampleRate;
        break;
      case 'bitrate':
        comparison = a.bitrate - b.bitrate;
        break;
      case 'bpm':
        comparison = (a.bpm || 0) - (b.bpm || 0);
        break;
      default:
        comparison = 0;
    }

    return rule.sortOrder === 'asc' ? comparison : -comparison;
  });

  if (rule.limit && rule.limit > 0) {
    return filtered.slice(0, rule.limit);
  }

  return filtered;
}

/**
 * Automatically creates smart playlists based on available library audio data
 */
export function autoGenerateSmartPlaylistsFromLibrary(tracks: Track[]): Playlist[] {
  const created: Playlist[] = [];

  // 1. Hi-Res Lossless Elite (FLAC, WAV, DSD, ALAC >= 24-bit or >= 88.2kHz)
  const hiResCount = tracks.filter((t) => t.isHiRes || t.bitDepth >= 24 || t.sampleRate >= 88200).length;
  if (hiResCount > 0) {
    created.push({
      id: `smart-auto-hires-${Date.now()}`,
      name: 'Studio Master Quality (24-bit+)',
      description: 'Exclusive lossless tracks with studio master resolution of 24-bit or 88.2kHz+.',
      isSmart: true,
      icon: 'ShieldCheck',
      coverGradient: 'from-amber-500/30 via-emerald-500/20 to-teal-900/40',
      rule: {
        onlyHiRes: true,
        minBitDepth: 24,
        sortBy: 'sampleRate',
        sortOrder: 'desc',
      },
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // 2. High Dynamic Range & High Bitrate
  created.push({
    id: `smart-auto-bitrate-${Date.now() + 1}`,
    name: 'Pure Uncompressed (High Bitrate)',
    description: 'Tracks with bitrates exceeding 1411 kbps (CD & Master grade).',
    isSmart: true,
    icon: 'Radio',
    coverGradient: 'from-cyan-500/30 via-blue-600/20 to-indigo-900/40',
    rule: {
      minBitrate: 1400,
      sortBy: 'bitrate',
      sortOrder: 'desc',
    },
    trackIds: [],
    createdAt: Date.now() + 1,
    updatedAt: Date.now() + 1,
  });

  // 3. Late Night Chill (BPM <= 95)
  const chillCount = tracks.filter((t) => t.bpm && t.bpm <= 95).length;
  if (chillCount > 0) {
    created.push({
      id: `smart-auto-chill-${Date.now() + 2}`,
      name: 'Late Night Chill & Lo-Fi',
      description: 'Relaxed tempos (below 95 BPM) ideal for nighttime listening.',
      isSmart: true,
      icon: 'Moon',
      coverGradient: 'from-purple-600/30 via-indigo-600/20 to-slate-900/40',
      rule: {
        maxBpm: 95,
        sortBy: 'playCount',
        sortOrder: 'desc',
      },
      trackIds: [],
      createdAt: Date.now() + 2,
      updatedAt: Date.now() + 2,
    });
  }

  // 4. Uptempo Peak Energy (BPM >= 120)
  const energeticCount = tracks.filter((t) => t.bpm && t.bpm >= 120).length;
  if (energeticCount > 0) {
    created.push({
      id: `smart-auto-energy-${Date.now() + 3}`,
      name: 'High-Energy Flow & Drive',
      description: 'Fast-paced rhythmic tracks (120+ BPM) to keep momentum high.',
      isSmart: true,
      icon: 'Zap',
      coverGradient: 'from-rose-500/30 via-amber-500/20 to-red-900/40',
      rule: {
        minBpm: 120,
        sortBy: 'bpm',
        sortOrder: 'desc',
      },
      trackIds: [],
      createdAt: Date.now() + 3,
      updatedAt: Date.now() + 3,
    });
  }

  return created;
}
