import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Playlist, RepeatMode, Track } from "../types/music";
import { getTracksForSmartPlaylist } from "./smartPlaylists";

/**
 * The link to Android Auto. Only the Android app has it: there, a native media
 * service shows the library in the car and forwards the car's buttons here,
 * while the playing itself stays in this web app.
 */
export const isNativeApp = Capacitor.isNativePlatform();
export const hasCarLink = isNativeApp && Capacitor.getPlatform() === "android";

export type CarCommand =
  | { action: "play" | "pause" | "next" | "prev" }
  | { action: "seek"; positionMs: number }
  | { action: "setShuffle"; enabled: boolean }
  | { action: "setRepeat"; mode: RepeatMode }
  /** A song picked in the car, with the list it was picked from. */
  | { action: "playItem"; trackId: string; trackIds: string[] }
  /** "Play ... on HighFi"; an empty query means "play some music". */
  | { action: "playSearch"; query: string };

interface CarGroup {
  id: string;
  title: string;
  subtitle?: string;
  trackIds: string[];
}

interface CarLibrary {
  tracks: { id: string; title: string; artist: string; album: string; durationMs: number }[];
  songs: string[];
  favorites: string[];
  recent: string[];
  albums: CarGroup[];
  artists: CarGroup[];
  playlists: CarGroup[];
}

export interface CarState {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  positionMs: number;
  playing: boolean;
  speed: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Base64 JPEG, sent only when the song changes. */
  artwork?: string;
}

interface CarMediaPlugin {
  setLibrary(library: CarLibrary): Promise<void>;
  updateState(state: CarState | { trackId: "" }): Promise<void>;
  addListener(event: "command", cb: (cmd: CarCommand) => void): Promise<{ remove: () => Promise<void> }>;
}

const CarMedia = registerPlugin<CarMediaPlugin>("CarMedia");

const byTitle = (a: Track, b: Track) => a.title.localeCompare(b.title);
const byAlbumOrder = (a: Track, b: Track) =>
  a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0) || byTitle(a, b);

function grouped(tracks: Track[], key: (t: Track) => string, order: (a: Track, b: Track) => number) {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const k = key(t) || "Unknown";
    const list = groups.get(k);
    if (list) list.push(t);
    else groups.set(k, [t]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => ({ name, list: list.sort(order) }));
}

function buildLibrary(tracks: Track[], playlists: Playlist[]): CarLibrary {
  const ids = (list: Track[]) => list.map((t) => t.id);
  const byId = new Map(tracks.map((t) => [t.id, t]));
  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationMs: Math.round((t.duration || 0) * 1000),
    })),
    songs: ids([...tracks].sort(byTitle)),
    favorites: ids(tracks.filter((t) => t.isFavorite).sort(byTitle)),
    recent: ids([...tracks].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 100)),
    albums: grouped(tracks, (t) => t.album, byAlbumOrder).map(({ name, list }) => ({
      id: name,
      title: name,
      subtitle: new Set(list.map((t) => t.artist)).size === 1 ? list[0].artist : "Various artists",
      trackIds: ids(list),
    })),
    artists: grouped(tracks, (t) => t.artist, byAlbumOrder).map(({ name, list }) => ({
      id: name,
      title: name,
      subtitle: list.length === 1 ? "1 song" : `${list.length} songs`,
      trackIds: ids(list),
    })),
    playlists: playlists.map((pl) => ({
      id: pl.id,
      title: pl.name,
      trackIds: pl.isSmart && pl.rule
        ? ids(getTracksForSmartPlaylist(tracks, pl.rule))
        : pl.trackIds.filter((id) => byId.has(id)),
    })),
  };
}

export function syncCarLibrary(tracks: Track[], playlists: Playlist[]): void {
  if (!hasCarLink) return;
  CarMedia.setLibrary(buildLibrary(tracks, playlists)).catch((err) => console.warn("Car library sync failed", err));
}

/** Cover art shrunk to a size the car can use, as base64 JPEG. */
async function artworkFor(track: Track): Promise<string | undefined> {
  if (!track.coverArtBlob) return undefined;
  try {
    const bitmap = await createImageBitmap(track.coverArtBlob);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  } catch {
    return undefined;
  }
}

let lastArtworkFor: string | null = null;

export async function syncCarState(
  track: Track | null,
  state: Omit<CarState, "trackId" | "title" | "artist" | "album" | "artwork">,
): Promise<void> {
  if (!hasCarLink) return;
  try {
    if (!track) {
      lastArtworkFor = null;
      await CarMedia.updateState({ trackId: "" });
      return;
    }
    let artwork: string | undefined;
    if (lastArtworkFor !== track.id) {
      lastArtworkFor = track.id;
      artwork = await artworkFor(track);
    }
    await CarMedia.updateState({ ...state, trackId: track.id, title: track.title, artist: track.artist, album: track.album, artwork });
  } catch (err) {
    console.warn("Car state sync failed", err);
  }
}

/** Listens for the car's buttons and picks. Returns the unsubscribe. */
export function onCarCommand(cb: (cmd: CarCommand) => void): () => void {
  if (!hasCarLink) return () => {};
  const handle = CarMedia.addListener("command", cb);
  return () => {
    handle.then((h) => h.remove());
  };
}
