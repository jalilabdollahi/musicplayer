import { Track, Playlist } from '../types/music';
import { parseLrc } from './lrcParser';

// Procedural high-res SVG cover art generators
function createCoverArt(theme: string, title: string, artist: string, accentColor1: string, accentColor2: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
    <defs>
      <linearGradient id="grad-${theme}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accentColor1}" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="${accentColor2}" />
      </linearGradient>
      <radialGradient id="glow-${theme}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${accentColor1}" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <pattern id="grid-${theme}" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad-${theme})" />
    <rect width="100%" height="100%" fill="url(#grid-${theme})" />
    <circle cx="250" cy="220" r="140" fill="url(#glow-${theme})" />
    
    <!-- Audiophile vinyl grooves / waveform rings -->
    <circle cx="250" cy="220" r="130" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-dasharray="8 6" />
    <circle cx="250" cy="220" r="100" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
    <circle cx="250" cy="220" r="70" fill="none" stroke="${accentColor1}" stroke-width="2.5" />
    <circle cx="250" cy="220" r="30" fill="#030712" stroke="${accentColor2}" stroke-width="3" />
    <circle cx="250" cy="220" r="6" fill="#f8fafc" />

    <!-- Badges -->
    <rect x="30" y="30" width="90" height="24" rx="12" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
    <text x="75" y="46" font-family="-apple-system, sans-serif" font-weight="700" font-size="10" fill="#38bdf8" text-anchor="middle" letter-spacing="1">HI-RES AUDIO</text>

    <!-- Typography -->
    <text x="40" y="415" font-family="-apple-system, sans-serif" font-weight="800" font-size="28" fill="#ffffff" letter-spacing="-0.5">${title}</text>
    <text x="40" y="445" font-family="-apple-system, sans-serif" font-weight="500" font-size="16" fill="rgba(255,255,255,0.7)" letter-spacing="0.5">${artist}</text>
    <text x="40" y="470" font-family="JetBrains Mono, monospace" font-size="11" fill="${accentColor1}" letter-spacing="1.5">MASTER QUALITY • 24-BIT / 96kHz</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Synced lyrics with authentic poetry/verses and timecodes
const LRC_ASTRAL = `[ti:Astral Velocity]
[ar:Aura Sound Lab]
[al:Celestial Horizons]
[offset:0]
[00:00.00]✦ [Instrumental Intro - Hi-Res Spatial Synth] ✦
[00:06.50]Gliding through the silent neon sky
[00:11.80]Signals pulses where the starlight lies
[00:17.20]Harmonics shifting in ninety-six kilohertz
[00:23.00]Lost between the stratosphere and earth
[00:28.40]Drifting through infinity, bit by bit
[00:34.00]Every high-res frequency perfectly lit
[00:39.80]Feel the analog warmth, crystal and clear
[00:45.20]Soundwaves falling gently on your ear
[00:51.50]✦ [Synthesizer Arpeggio Solo] ✦
[01:03.00]Lost in the echoes of a digital dream
[01:08.50]More vivid now than it could ever seem
[01:14.20]Lossless currents flowing in our veins
[01:19.80]Washing away the static and the pain
[01:25.50]Astral velocity guiding us home
[01:31.00]Through the dark universe we'll never roam alone
[01:37.00]✦ [Dynamic Outro - Reverb Decay] ✦`;

const LRC_MIDNIGHT = `[ti:Midnight in Shibuya]
[ar:Kenji Takahashi & Trio]
[al:Tokyo Rain Sessions]
[offset:0]
[00:00.00]✦ [Warm Vinyl Crackle & Fender Rhodes] ✦
[00:07.00]Raindrops tapping on the pavement glass
[00:13.20]Watching shadows of the nighttime pass
[00:19.50]A mellow saxophone, a cup of tea
[00:25.80]Just twenty-four bit warmth surrounding me
[00:32.40]Pedestrians hurry under glowing lights
[00:38.70]Lost in the rhythm of Tokyo nights
[00:45.00]Smooth double bass walking slow and sweet
[00:51.20]Echoing softly down the midnight street
[00:58.00]✦ [Jazz Piano Improvisation] ✦
[01:09.50]Time slows down when the rain falls deep
[01:16.00]The city that promises never to sleep
[01:22.50]Here in the haze of the midnight blue
[01:28.80]Every single note is honest and true
[01:35.00]✦ [Gentle Rhodes Fade Out] ✦`;

const LRC_SOLARIS = `[ti:Solaris Nocturne]
[ar:Elena Rostova]
[al:Grand Concert Hall Archive]
[offset:0]
[00:00.00]✦ [Solo Steinway D-274 Piano Prelude] ✦
[00:08.20]A single key strikes the midnight air
[00:15.00]Vibrating gently without a care
[00:21.80]Cello joins with deep acoustic grace
[00:28.50]Filling up the grandeur of the space
[00:35.00]Hear the pedal press, hear the hammer fall
[00:42.20]Reflecting softly off the marble wall
[00:49.00]One hundred ninety-two kilohertz pure
[00:56.00]A melody designed to endure
[01:03.50]✦ [Chamber Strings & Piano Crescendo] ✦
[01:16.00]In the quiet solace of the night
[01:23.00]Music turns the darkness into light
[01:30.00]Rest your mind beneath the stellar dome
[01:37.50]This harmonic sanctuary is your home
[01:45.00]✦ [Acoustic Reverb Chamber Tail] ✦`;

const LRC_HYPERDRIVE = `[ti:Hyperdrive Resonance]
[ar:Cyberpulse Audio]
[al:Sub-Bass Matrix]
[offset:0]
[00:00.00]✦ [Fast Breakbeat & Sub-Bass Modulation] ✦
[00:05.50]Ignition sequence engaged in the core
[00:10.80]Pushing frequencies like never before
[00:16.00]One hundred seventy-four beats a minute fast
[00:21.40]Leave all the limits of the past
[00:26.80]Feel the sub-bass shaking the floor
[00:32.00]High-velocity sound wanting more
[00:37.50]Zero distortion, transient attack
[00:43.00]No holding anything back
[00:48.50]✦ [Drop - Fast Drum & Bass Breakdown] ✦
[01:02.00]Resonating straight through your soul
[01:07.50]Pure momentum taking full control
[01:13.00]Speed of light on an acoustic track
[01:18.50]Once you go lossless you never go back
[01:25.00]✦ [Sub-Bass Echo & Filter Sweep] ✦`;

const LRC_FOREST = `[ti:Echoes of the Deep Forest]
[ar:Aura Ambient Collective]
[al:Binaural Earth Sanctuary]
[offset:0]
[00:00.00]✦ [Binaural Wind, Moss & Distant River] ✦
[00:09.00]Breathe in the morning mountain breeze
[00:17.50]Sunlight filtering between ancient trees
[00:26.00]A quiet bell rings far away
[00:34.50]Welcoming the arrival of the day
[00:43.00]Spatial acoustic depths expand wide
[00:51.50]Peacefulness dwelling deep inside
[01:00.00]Water ripples on stones so clean
[01:09.00]The calmest sound you have ever seen
[01:18.00]✦ [Meditation Tibetan Bowl Resonance] ✦
[01:30.00]Let your thoughts float away in peace
[01:40.00]Where all the racing worries cease
[01:50.00]✦ [Gentle Forest Breeze Fade] ✦`;

export const INITIAL_DEMO_TRACKS: Track[] = [
  {
    id: 'demo-astral-velocity',
    title: 'Astral Velocity',
    artist: 'Aura Sound Lab',
    album: 'Celestial Horizons (Hi-Res Master)',
    duration: 110,
    format: 'FLAC',
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    bitrate: 2822,
    genre: 'Synthwave / Electronic',
    year: 2026,
    bpm: 124,
    key: 'F# Minor',
    coverArtUrl: createCoverArt('astral', 'Astral Velocity', 'Aura Sound Lab', '#38bdf8', '#818cf8'),
    lyrics: parseLrc(LRC_ASTRAL).lyrics,
    rawLrc: LRC_ASTRAL,
    isFavorite: true,
    playCount: 14,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 3,
    isHiRes: true,
    fileSize: 38400000,
  },
  {
    id: 'demo-midnight-shibuya',
    title: 'Midnight in Shibuya',
    artist: 'Kenji Takahashi Trio',
    album: 'Tokyo Rain Sessions (Vinyl Master)',
    duration: 108,
    format: 'FLAC',
    sampleRate: 88200,
    bitDepth: 24,
    channels: 2,
    bitrate: 2410,
    genre: 'Lo-Fi Jazz / Neo-Soul',
    year: 2025,
    bpm: 85,
    key: 'Eb Major',
    coverArtUrl: createCoverArt('shibuya', 'Midnight in Shibuya', 'Kenji Takahashi Trio', '#f59e0b', '#dc2626'),
    lyrics: parseLrc(LRC_MIDNIGHT).lyrics,
    rawLrc: LRC_MIDNIGHT,
    isFavorite: true,
    playCount: 22,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 7,
    isHiRes: true,
    fileSize: 34200000,
  },
  {
    id: 'demo-solaris-nocturne',
    title: 'Solaris Nocturne',
    artist: 'Elena Rostova',
    album: 'Grand Concert Hall Archive',
    duration: 120,
    format: 'WAV',
    sampleRate: 192000,
    bitDepth: 24,
    channels: 2,
    bitrate: 9216,
    genre: 'Classical / Acoustic Piano',
    year: 2026,
    bpm: 72,
    key: 'C# Minor',
    coverArtUrl: createCoverArt('solaris', 'Solaris Nocturne', 'Elena Rostova', '#e2b053', '#1e293b'),
    lyrics: parseLrc(LRC_SOLARIS).lyrics,
    rawLrc: LRC_SOLARIS,
    isFavorite: false,
    playCount: 9,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 1,
    isHiRes: true,
    fileSize: 138000000,
  },
  {
    id: 'demo-hyperdrive-resonance',
    title: 'Hyperdrive Resonance',
    artist: 'Cyberpulse Audio',
    album: 'Sub-Bass Matrix',
    duration: 98,
    format: 'FLAC',
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    bitrate: 3120,
    genre: 'Drum & Bass / Cyberpunk',
    year: 2026,
    bpm: 174,
    key: 'D Minor',
    coverArtUrl: createCoverArt('hyperdrive', 'Hyperdrive', 'Cyberpulse Audio', '#06b6d4', '#ec4899'),
    lyrics: parseLrc(LRC_HYPERDRIVE).lyrics,
    rawLrc: LRC_HYPERDRIVE,
    isFavorite: false,
    playCount: 18,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 12,
    isHiRes: true,
    fileSize: 39100000,
  },
  {
    id: 'demo-forest-echoes',
    title: 'Echoes of the Deep Forest',
    artist: 'Aura Ambient Collective',
    album: 'Binaural Earth Sanctuary',
    duration: 130,
    format: 'DSD',
    sampleRate: 192000,
    bitDepth: 32,
    channels: 2,
    bitrate: 5645,
    genre: 'Ambient / Binaural Nature',
    year: 2025,
    bpm: 60,
    key: 'A Major',
    coverArtUrl: createCoverArt('forest', 'Deep Forest', 'Aura Ambient', '#10b981', '#064e3b'),
    lyrics: parseLrc(LRC_FOREST).lyrics,
    rawLrc: LRC_FOREST,
    isFavorite: true,
    playCount: 31,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 15,
    isHiRes: true,
    fileSize: 84000000,
  },
];

export const INITIAL_SMART_PLAYLISTS: Playlist[] = [
  {
    id: 'smart-hires-masters',
    name: 'Hi-Res Lossless Masters',
    description: 'Ultra high-fidelity 24-bit/96kHz+ recordings with maximum dynamic range.',
    isSmart: true,
    icon: 'Sparkles',
    coverGradient: 'from-amber-500/30 via-cyan-500/20 to-blue-600/30',
    rule: {
      onlyHiRes: true,
      minBitDepth: 24,
      minSampleRate: 88200,
      sortBy: 'sampleRate',
      sortOrder: 'desc',
    },
    trackIds: [],
    createdAt: Date.now() - 100000,
    updatedAt: Date.now(),
  },
  {
    id: 'smart-late-night-chill',
    name: 'Late Night Chill & Lo-Fi',
    description: 'Smooth, relaxed tempos (< 95 BPM) perfect for evening contemplation.',
    isSmart: true,
    icon: 'Moon',
    coverGradient: 'from-purple-600/30 via-indigo-600/20 to-slate-900/40',
    rule: {
      maxBpm: 95,
      sortBy: 'playCount',
      sortOrder: 'desc',
    },
    trackIds: [],
    createdAt: Date.now() - 90000,
    updatedAt: Date.now(),
  },
  {
    id: 'smart-high-energy-flow',
    name: 'High-Energy Flow',
    description: 'Uptempo tracks (> 120 BPM) for deep focus and workout sessions.',
    isSmart: true,
    icon: 'Zap',
    coverGradient: 'from-rose-500/30 via-orange-500/20 to-amber-600/30',
    rule: {
      minBpm: 120,
      sortBy: 'bpm',
      sortOrder: 'desc',
    },
    trackIds: [],
    createdAt: Date.now() - 80000,
    updatedAt: Date.now(),
  },
  {
    id: 'smart-audiophile-favorites',
    name: 'Audiophile Favorites',
    description: 'Your starred reference tracks for acoustic testing and critical listening.',
    isSmart: true,
    icon: 'Heart',
    coverGradient: 'from-pink-500/30 via-rose-500/20 to-purple-600/30',
    rule: {
      onlyFavorites: true,
      sortBy: 'playCount',
      sortOrder: 'desc',
    },
    trackIds: [],
    createdAt: Date.now() - 70000,
    updatedAt: Date.now(),
  },
];
