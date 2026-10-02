/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Disc3, FolderOpen, Library, ListMusic, Music2, Plus, Trash2, TriangleAlert, Upload, Users } from "lucide-react";
import { AudioEngineSettings, LinkedFolder, Playlist, RepeatMode, SyncedLyricLine, Track } from "./types/music";
import { audioEngine } from "./services/audioEngine";
import {
  deleteFolder,
  deletePlaylist,
  deleteTrack,
  deleteTracks,
  getAllFolders,
  getAllPlaylists,
  getAllTracks,
  isDemoPlaylist,
  isDemoTrack,
  saveFolder,
  savePlaylist,
  saveTracks,
  updateTrack,
} from "./services/db";
import { getTracksForSmartPlaylist } from "./services/smartPlaylists";
import { isAudioFileName, isLyricsFileName } from "./services/audioMetadata";
import { parseLrc } from "./services/lrcParser";
import {
  FolderPermissionError,
  ScanProgress,
  ensureFolderPermission,
  entriesFromDataTransfer,
  filesFromEntries,
  getStorageEstimate,
  getTrackAudio,
  importFiles,
  pickFolder,
  requestPersistentStorage,
  scanFolder,
  supportsFolderLinking,
} from "./services/library";

import { Sidebar } from "./components/Sidebar";
import { TrackList, TrackActions } from "./components/TrackList";
import { PlayerBar } from "./components/PlayerBar";
import { NowPlaying, NowPlayingPanel } from "./components/NowPlaying";
import { EqualizerModal } from "./components/EqualizerModal";
import { TrackInfoModal } from "./components/TrackInfoModal";
import { SmartPlaylistModal } from "./components/SmartPlaylistModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { AddMusicModal } from "./components/AddMusicModal";
import {
  Album,
  AlbumGrid,
  ArtistGrid,
  EmptyState,
  PageHeader,
  PlayActions,
  PlaylistsIndex,
  SortKey,
  SourcesView,
  Toolbar,
  Welcome,
  albumKey,
  groupAlbums,
  groupArtists,
  totalDuration,
} from "./components/Views";
import { Artwork, IconButton, cx, useArtworkAccent } from "./components/ui";

export type Route =
  | { kind: "songs" }
  | { kind: "albums" }
  | { kind: "album"; key: string }
  | { kind: "artists" }
  | { kind: "artist"; name: string }
  | { kind: "favorites" }
  | { kind: "recent" }
  | { kind: "playlist"; id: string }
  | { kind: "playlists" }
  | { kind: "sources" };

// ---------------------------------------------------------------- Session persistence

const SESSION_KEY = "highfi.session";

interface Session {
  queueIds: string[];
  index: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  settings: AudioEngineSettings;
  sort?: SortKey;
}

function loadSession(): Partial<Session> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Partial<Session>) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage full or blocked; the session simply won't be restored.
  }
}

const savedSession = loadSession();
if (savedSession?.settings) audioEngine.applySettings(savedSession.settings);

function withCoverUrl(track: Track): Track {
  return track.coverArtBlob && !track.coverArtUrl ? { ...track, coverArtUrl: URL.createObjectURL(track.coverArtBlob) } : track;
}

/** Drops the in-memory audio copy once it is safely in IndexedDB. */
function withoutAudio(track: Track): Track {
  const { audioBlob, ...rest } = track;
  return rest;
}

function sortTracks(list: Track[], sort: SortKey): Track[] {
  const out = [...list];
  switch (sort) {
    case "artist":
      return out.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0));
    case "album":
      return out.sort((a, b) => a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0));
    case "dateAdded":
      return out.sort((a, b) => b.dateAdded - a.dateAdded);
    case "playCount":
      return out.sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title));
    default:
      return out.sort((a, b) => a.title.localeCompare(b.title));
  }
}

function matchesQuery(t: Track, q: string): boolean {
  return (
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    t.album.toLowerCase().includes(q) ||
    (t.genre ?? "").toLowerCase().includes(q)
  );
}

interface Toast {
  text: string;
  progress?: ScanProgress;
  action?: { label: string; run: () => void };
}

export default function App() {
  // Library
  const [ready, setReady] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [folders, setFolders] = useState<LinkedFolder[]>([]);
  const [folderAccess, setFolderAccess] = useState<Record<string, boolean>>({});
  const [scanning, setScanning] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  // Navigation
  const [route, setRoute] = useState<Route>({ kind: "songs" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(savedSession?.sort ?? "title");

  // Playback
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(savedSession?.shuffle ?? false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(savedSession?.repeatMode ?? "all");
  const [shuffleHistory, setShuffleHistory] = useState<number[]>([]);
  const [audioSettings, setAudioSettings] = useState<AudioEngineSettings>(() => audioEngine.getSettings());

  // Overlays
  const [nowPlaying, setNowPlaying] = useState<{ panel?: NowPlayingPanel } | null>(null);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [infoTrack, setInfoTrack] = useState<Track | null>(null);
  const [showSmartPlaylist, setShowSmartPlaylist] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAddMusic, setShowAddMusic] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const loadToken = useRef(0);

  // Engine callbacks and async work read the latest state through these.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const foldersRef = useRef(folders);
  foldersRef.current = folders;

  const currentTrack: Track | null = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  useArtworkAccent(currentTrack?.coverArtUrl, currentTrack?.album ?? "");

  const showToast = useCallback((next: Toast | null, ttl = 3500) => {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    if (next && !next.progress) toastTimer.current = window.setTimeout(() => setToast(null), ttl);
  }, []);

  const refreshStorage = useCallback(() => {
    getStorageEstimate().then(setStorage);
  }, []);

  // ---------------------------------------------------------------- Navigation

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    setQuery("");
    window.history.pushState({ route: next }, "");
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    window.history.replaceState({ route: { kind: "songs" } }, "");
    const onPop = (e: PopStateEvent) => {
      setRoute((e.state?.route as Route) ?? { kind: "songs" });
      setQuery("");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ---------------------------------------------------------------- Library updates

  const mergeTracks = useCallback((incoming: Track[], removedIds: string[] = []) => {
    const removed = new Set(removedIds);
    const byId = new Map(incoming.map((t) => [t.id, withCoverUrl(withoutAudio(t))]));
    const apply = (list: Track[]) => {
      const kept = list.filter((t) => !removed.has(t.id)).map((t) => byId.get(t.id) ?? t);
      const known = new Set(list.map((t) => t.id));
      return [...kept, ...[...byId.values()].filter((t) => !known.has(t.id))];
    };
    setTracks(apply);
    // Keep queued copies fresh, but never reorder or extend the queue here.
    setQueue((q) => q.map((t) => byId.get(t.id) ?? t));
  }, []);

  const runScan = useCallback(
    async (folder: LinkedFolder, quiet = false) => {
      setScanning(true);
      if (!quiet) showToast({ text: `Scanning “${folder.name}”…`, progress: { done: 0, total: 0 } });
      try {
        const result = await scanFolder(folder, tracksRef.current, (progress) => {
          if (!quiet || progress.total - progress.done > 0) {
            if (progress.total > 0 && (progress.done % 5 === 0 || progress.done === progress.total)) {
              setToast({ text: `Scanning “${folder.name}”`, progress });
            }
          }
        });
        const changed = [...result.added, ...result.updated];
        if (changed.length) await saveTracks(changed);
        if (result.removedIds.length) await deleteTracks(result.removedIds);
        mergeTracks(changed, result.removedIds);

        const scanned = { ...folder, lastScanAt: Date.now() };
        await saveFolder(scanned);
        setFolders((prev) => prev.map((f) => (f.id === folder.id ? scanned : f)));

        const parts = [
          result.added.length && `${result.added.length} new`,
          result.updated.length && `${result.updated.length} updated`,
          result.removedIds.length && `${result.removedIds.length} removed`,
        ].filter(Boolean);
        if (!quiet || parts.length) showToast({ text: parts.length ? `“${folder.name}”: ${parts.join(", ")}` : `“${folder.name}” is up to date` });
        else setToast(null);
      } catch (err) {
        console.error("Folder scan failed", err);
        showToast({ text: `Couldn't read “${folder.name}”. It may have been moved or renamed.` }, 6000);
        setFolderAccess((prev) => ({ ...prev, [folder.id]: false }));
      } finally {
        setScanning(false);
      }
    },
    [mergeTracks, showToast],
  );

  // ---------------------------------------------------------------- Startup

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let loaded = await getAllTracks();
        let loadedPlaylists = await getAllPlaylists();
        const loadedFolders = await getAllFolders();

        const demo = loaded.filter(isDemoTrack);
        if (demo.length) {
          await deleteTracks(demo.map((t) => t.id));
          loaded = loaded.filter((t) => !isDemoTrack(t));
        }
        const demoPlaylists = loadedPlaylists.filter(isDemoPlaylist);
        for (const pl of demoPlaylists) await deletePlaylist(pl.id);
        loadedPlaylists = loadedPlaylists.filter((p) => !isDemoPlaylist(p));
        if (cancelled) return;

        setTracks(loaded);
        setPlaylists(loadedPlaylists);
        setFolders(loadedFolders);
        tracksRef.current = loaded;

        // Restore where the listener left off, without starting playback.
        const byId = new Map(loaded.map((t) => [t.id, t]));
        const restored = (savedSession?.queueIds ?? []).map((id) => byId.get(id)).filter((t): t is Track => !!t);
        const index = Math.min(Math.max(savedSession?.index ?? 0, 0), restored.length - 1);
        if (restored.length) {
          setQueue(restored);
          setCurrentIndex(index);
          setDuration(restored[index]?.duration ?? 0);
        }
        setReady(true);

        const access: Record<string, boolean> = {};
        for (const folder of loadedFolders) access[folder.id] = await ensureFolderPermission(folder.handle, false);
        if (cancelled) return;
        setFolderAccess(access);
        for (const folder of loadedFolders) if (access[folder.id]) await runScan(folder, true);
      } catch (err) {
        console.error("Error opening the library", err);
        setReady(true);
      }
      refreshStorage();
    })();
    return () => {
      cancelled = true;
    };
    // Runs once; runScan and refreshStorage are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the session.
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(
      () => saveSession({ queueIds: queue.map((t) => t.id), index: currentIndex, shuffle, repeatMode, settings: audioSettings, sort }),
      400,
    );
    return () => window.clearTimeout(id);
  }, [ready, queue, currentIndex, shuffle, repeatMode, audioSettings, sort]);

  // Window title follows the music.
  useEffect(() => {
    document.title = currentTrack && isPlaying ? `${currentTrack.title} · ${currentTrack.artist}` : "HighFi";
  }, [currentTrack, isPlaying]);

  // ---------------------------------------------------------------- Playback

  const handleTrackEndedRef = useRef<() => void>(() => {});
  const handlePlayPauseRef = useRef<() => void>(() => {});
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});
  const handleSeekRef = useRef<(to: number) => void>(() => {});

  useEffect(() => {
    audioEngine.onTimeUpdate((time, dur) => {
      setCurrentTime(time);
      if (dur > 0 && Number.isFinite(dur)) setDuration(dur);
    });
    audioEngine.onStateChange(setIsPlaying);
    audioEngine.onEnded(() => handleTrackEndedRef.current());
    audioEngine.registerMediaSessionHandlers({
      play: () => handlePlayPauseRef.current(),
      pause: () => handlePlayPauseRef.current(),
      prev: () => handlePrevRef.current(),
      next: () => handleNextRef.current(),
      seek: (to) => handleSeekRef.current(to),
    });
  }, []);

  const playTrackAtIndex = useCallback(
    async (index: number, fromQueue?: Track[]) => {
      const activeQueue = fromQueue ?? queueRef.current;
      const track = activeQueue[index];
      if (!track) return;
      const token = ++loadToken.current;
      setCurrentIndex(index);
      setCurrentTime(0);
      setDuration(track.duration || 0);

      let audio: Blob | null = null;
      try {
        audio = await getTrackAudio(track, foldersRef.current);
      } catch (err) {
        if (err instanceof FolderPermissionError) {
          setFolderAccess((prev) => ({ ...prev, [err.folder.id]: false }));
          showToast({ text: `Allow access to “${err.folder.name}” to play this song.` }, 6000);
        } else {
          console.error(err);
          showToast({ text: "This song's file couldn't be found. It may have been moved or deleted." }, 6000);
        }
        return;
      }
      if (token !== loadToken.current) return;
      if (!audio) {
        showToast({ text: "This song's audio is missing from storage." }, 6000);
        return;
      }

      await audioEngine.loadTrack({ ...track, audioBlob: audio }, true);
      if (token !== loadToken.current) return;

      const playCount = (track.playCount || 0) + 1;
      updateTrack(track.id, { playCount });
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, playCount } : t)));
    },
    [showToast],
  );

  // Files whose header has no duration learn it from the first play.
  useEffect(() => {
    if (!currentTrack || currentTrack.duration > 0 || duration <= 0) return;
    const id = currentTrack.id;
    updateTrack(id, { duration });
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, duration } : t)));
    setQueue((prev) => prev.map((t) => (t.id === id ? { ...t, duration } : t)));
  }, [currentTrack, duration]);

  /** A random queue position that has not played recently. */
  const pickShuffleIndex = useCallback((): number => {
    const n = queue.length;
    if (n <= 1) return 0;
    const recent = new Set([...shuffleHistory.slice(-Math.floor(n / 2)), currentIndex]);
    const candidates = Array.from({ length: n }, (_, i) => i).filter((i) => !recent.has(i));
    const pool = candidates.length ? candidates : Array.from({ length: n }, (_, i) => i).filter((i) => i !== currentIndex);
    return pool[Math.floor(Math.random() * pool.length)];
  }, [queue.length, shuffleHistory, currentIndex]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    if (shuffle) {
      setShuffleHistory((h) => [...h, currentIndex]);
      playTrackAtIndex(pickShuffleIndex());
    } else {
      playTrackAtIndex((currentIndex + 1) % queue.length);
    }
  }, [queue.length, shuffle, currentIndex, pickShuffleIndex, playTrackAtIndex]);

  const handleTrackEnded = useCallback(() => {
    if (repeatMode === "one") {
      audioEngine.seek(0);
      audioEngine.play();
      return;
    }
    const atEnd = !shuffle && currentIndex + 1 >= queue.length;
    if (atEnd && repeatMode === "off") {
      setIsPlaying(false);
      return;
    }
    handleNext();
  }, [repeatMode, shuffle, currentIndex, queue.length, handleNext]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    if (audioEngine.getCurrentTime() > 3) {
      audioEngine.seek(0);
      return;
    }
    if (shuffle && shuffleHistory.length) {
      const prev = shuffleHistory[shuffleHistory.length - 1];
      setShuffleHistory((h) => h.slice(0, -1));
      playTrackAtIndex(prev);
      return;
    }
    playTrackAtIndex((currentIndex - 1 + queue.length) % queue.length);
  }, [queue.length, shuffle, shuffleHistory, currentIndex, playTrackAtIndex]);

  const handlePlayPause = useCallback(async () => {
    if (!currentTrack) {
      if (queue.length) await playTrackAtIndex(0);
      else if (tracks.length) {
        const list = sortTracks(tracks, sort);
        setQueue(list);
        await playTrackAtIndex(0, list);
      }
      return;
    }
    if (isPlaying) {
      audioEngine.pause();
      return;
    }
    // After a reload the queue is restored but nothing is loaded yet.
    if (audioEngine.getLoadedTrackId() !== currentTrack.id) {
      const resumeAt = currentTime;
      await playTrackAtIndex(currentIndex);
      if (resumeAt > 0) audioEngine.seek(resumeAt);
      return;
    }
    await audioEngine.play();
  }, [currentTrack, queue.length, tracks, sort, isPlaying, currentTime, currentIndex, playTrackAtIndex]);

  const handleSeek = useCallback((seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  }, []);

  useEffect(() => {
    handleTrackEndedRef.current = handleTrackEnded;
    handlePlayPauseRef.current = handlePlayPause;
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
    handleSeekRef.current = handleSeek;
  }, [handleTrackEnded, handlePlayPause, handleNext, handlePrev, handleSeek]);

  const playList = useCallback(
    (list: Track[], startAt = 0, shuffled = false) => {
      if (!list.length) return;
      setQueue(list);
      setShuffleHistory([]);
      if (shuffled !== shuffle && (shuffled || startAt === 0)) setShuffle(shuffled);
      const index = shuffled ? Math.floor(Math.random() * list.length) : startAt;
      playTrackAtIndex(index, list);
    },
    [shuffle, playTrackAtIndex],
  );

  const handleSetVolume = (volume: number) => {
    audioEngine.setMuted(false);
    audioEngine.setVolume(volume);
    setAudioSettings((prev) => ({ ...prev, volume, isMuted: false }));
  };

  const handleToggleMute = () => {
    const isMuted = !audioSettings.isMuted;
    audioEngine.setMuted(isMuted);
    setAudioSettings((prev) => ({ ...prev, isMuted }));
  };

  const handleToggleShuffle = () => {
    setShuffle((s) => !s);
    setShuffleHistory([]);
  };

  const handleCycleRepeat = () => setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));

  // ---------------------------------------------------------------- Queue editing

  const playNext = (track: Track) => {
    if (!currentTrack) return playList([track]);
    setQueue((q) => [...q.slice(0, currentIndex + 1), track, ...q.slice(currentIndex + 1)]);
    showToast({ text: `“${track.title}” will play next` });
  };

  const addToQueue = (track: Track) => {
    if (!currentTrack) return playList([track]);
    setQueue((q) => [...q, track]);
    showToast({ text: `Added “${track.title}” to the queue` });
  };

  const removeFromQueue = (index: number) => {
    if (index === currentIndex) return;
    setQueue((q) => q.filter((_, i) => i !== index));
    if (index < currentIndex) setCurrentIndex((i) => i - 1);
    setShuffleHistory([]);
  };

  // ---------------------------------------------------------------- Track edits

  const patchTrack = (id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setQueue((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setInfoTrack((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const toggleFavorite = async (id: string) => {
    const target = tracks.find((t) => t.id === id);
    if (!target) return;
    const isFavorite = !target.isFavorite;
    patchTrack(id, { isFavorite });
    await updateTrack(id, { isFavorite });
  };

  const updateLyrics = async (id: string, lyrics: SyncedLyricLine[], rawLrc: string) => {
    patchTrack(id, { lyrics, rawLrc });
    await updateTrack(id, { lyrics, rawLrc });
  };

  const forgetTracks = useCallback(
    (ids: Set<string>) => {
      setTracks((prev) => {
        for (const t of prev) if (ids.has(t.id) && t.coverArtUrl?.startsWith("blob:")) URL.revokeObjectURL(t.coverArtUrl);
        return prev.filter((t) => !ids.has(t.id));
      });

      const q = queueRef.current;
      const playingRemoved = currentTrack && ids.has(currentTrack.id);
      const nextQueue = q.filter((t) => !ids.has(t.id));
      if (nextQueue.length !== q.length) {
        const before = q.slice(0, currentIndex).filter((t) => ids.has(t.id)).length;
        setQueue(nextQueue);
        setShuffleHistory([]);
        if (playingRemoved) {
          audioEngine.pause();
          setCurrentTime(0);
          const next = nextQueue.length ? Math.min(currentIndex - before, nextQueue.length - 1) : -1;
          setCurrentIndex(next);
          setDuration(next >= 0 ? nextQueue[next].duration : 0);
        } else {
          setCurrentIndex((i) => i - before);
        }
      }

      const affected = playlists.filter((pl) => !pl.isSmart && pl.trackIds.some((id) => ids.has(id)));
      if (affected.length) {
        const updated = affected.map((pl) => ({ ...pl, trackIds: pl.trackIds.filter((id) => !ids.has(id)), updatedAt: Date.now() }));
        updated.forEach((pl) => savePlaylist(pl));
        setPlaylists((prev) => prev.map((pl) => updated.find((u) => u.id === pl.id) ?? pl));
      }
      setInfoTrack((prev) => (prev && ids.has(prev.id) ? null : prev));
    },
    [currentTrack, currentIndex, playlists],
  );

  const removeTrack = async (track: Track) => {
    await deleteTrack(track.id);
    if (track.source === "folder" && track.folderId && track.relPath) {
      // Remember the removal, or the next rescan would bring the file back.
      const folder = folders.find((f) => f.id === track.folderId);
      if (folder) {
        const updated = { ...folder, excluded: [...(folder.excluded ?? []), track.relPath] };
        await saveFolder(updated);
        setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      }
    }
    forgetTracks(new Set([track.id]));
    showToast({ text: `Removed “${track.title}” from your library` });
    refreshStorage();
  };

  // ---------------------------------------------------------------- Adding music

  const addImported = async (items: { file: File; relPath?: string }[], playFirst = false) => {
    const audioItems = items.filter((i) => isAudioFileName(i.file.name));
    const lrcItems = items.filter((i) => isLyricsFileName(i.file.name));

    // Lyrics on their own attach to whatever is playing.
    if (audioItems.length === 0) {
      if (lrcItems.length && currentTrack) {
        const text = await lrcItems[0].file.text();
        await updateLyrics(currentTrack.id, parseLrc(text).lyrics, text);
        setNowPlaying({ panel: "lyrics" });
      } else if (items.length) {
        showToast({ text: "No supported audio files found." });
      }
      return;
    }

    // Skip files already imported (same name and size).
    const existing = new Map(
      tracksRef.current.filter((t) => t.source !== "folder").map((t) => [`${t.filePath}|${t.fileSize}`, t]),
    );
    const known: Track[] = [];
    const fresh = items.filter((i) => {
      if (!isAudioFileName(i.file.name)) return true;
      const hit = existing.get(`${i.relPath ?? i.file.name}|${i.file.size}`);
      if (hit) known.push(hit);
      return !hit;
    });

    let added: Track[] = [];
    if (fresh.some((i) => isAudioFileName(i.file.name))) {
      showToast({ text: "Importing", progress: { done: 0, total: audioItems.length } });
      added = await importFiles(fresh, (progress) => setToast({ text: "Importing", progress }));
      try {
        await saveTracks(added);
      } catch (err) {
        console.error(err);
        showToast({ text: "Not enough storage to import these files." }, 6000);
        return;
      }
      requestPersistentStorage();
      mergeTracks(added);
      refreshStorage();
    }

    const total = added.length + known.length;
    showToast({
      text: added.length
        ? `Added ${added.length} ${added.length === 1 ? "song" : "songs"}${known.length ? ` (${known.length} already in library)` : ""}`
        : `${known.length === 1 ? "That song is" : "Those songs are"} already in your library`,
    });
    if (playFirst && total) playList([...added.map(withoutAudio), ...known]);
  };

  const linkFolder = async (handle?: FileSystemDirectoryHandle | null) => {
    try {
      const picked = handle ?? (await pickFolder());
      if (!picked) return;
      for (const f of folders) {
        if (await f.handle.isSameEntry(picked)) {
          showToast({ text: `“${picked.name}” is already linked` });
          return runScan(f);
        }
      }
      const folder: LinkedFolder = { id: `folder-${Date.now().toString(36)}`, name: picked.name, handle: picked, addedAt: Date.now() };
      await saveFolder(folder);
      setFolders((prev) => [...prev, folder]);
      setFolderAccess((prev) => ({ ...prev, [folder.id]: true }));
      requestPersistentStorage();
      await runScan(folder);
      if (route.kind !== "sources") navigate({ kind: "songs" });
    } catch (err) {
      console.error(err);
      showToast({ text: "Couldn't open that folder." });
    }
  };

  const reconnectFolder = async (folder: LinkedFolder) => {
    const granted = await ensureFolderPermission(folder.handle, true);
    setFolderAccess((prev) => ({ ...prev, [folder.id]: granted }));
    if (granted) runScan(folder, true);
  };

  const unlinkFolder = async (folder: LinkedFolder) => {
    const count = tracks.filter((t) => t.folderId === folder.id).length;
    if (!window.confirm(`Unlink “${folder.name}”? Its ${count} songs leave your library. Files on disk aren't touched.`)) return;
    const ids = tracks.filter((t) => t.folderId === folder.id).map((t) => t.id);
    await deleteTracks(ids);
    await deleteFolder(folder.id);
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    forgetTracks(new Set(ids));
  };

  const clearImported = async () => {
    const ids = tracks.filter((t) => t.source !== "folder").map((t) => t.id);
    if (!window.confirm(`Remove all ${ids.length} imported songs from this device? Original files elsewhere aren't touched.`)) return;
    await deleteTracks(ids);
    forgetTracks(new Set(ids));
    refreshStorage();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
    // Both reads must happen before the first await.
    const entries = entriesFromDataTransfer(dt);
    const handles = supportsFolderLinking
      ? Array.from(dt.items).map((item) =>
          (item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }).getAsFileSystemHandle?.(),
        )
      : [];
    const fallbackFiles = Array.from(dt.files);

    (async () => {
      if (handles.length && handles.every(Boolean)) {
        const resolved = await Promise.all(handles);
        if (resolved.length && resolved.every((h) => h?.kind === "directory")) {
          for (const h of resolved) await linkFolder(h as FileSystemDirectoryHandle);
          return;
        }
      }
      const files = entries.length ? await filesFromEntries(entries) : fallbackFiles.map((file) => ({ file }));
      addImported(files);
    })();
  };

  // Files opened from the OS ("Open with HighFi") once installed.
  useEffect(() => {
    const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (p: { files: FileSystemFileHandle[] }) => void): void } }).launchQueue;
    if (!lq || !ready) return;
    lq.setConsumer(async ({ files }) => {
      if (!files?.length) return;
      const loaded = await Promise.all(files.map(async (h) => ({ file: await h.getFile() })));
      addImported(loaded, true);
    });
    // Registered once the library is loaded so duplicates can be detected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ---------------------------------------------------------------- Keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        if (e.key === "Escape" && el === searchRef.current) el.blur();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const handled = () => e.preventDefault();

      if (e.code === "Space" && !(el instanceof HTMLButtonElement)) {
        handled();
        handlePlayPause();
      } else if (mod && e.key === "ArrowRight") {
        handled();
        handleNext();
      } else if (mod && e.key === "ArrowLeft") {
        handled();
        handlePrev();
      } else if (e.altKey && e.key === "ArrowRight") {
        handled();
        handleSeek(Math.min(duration, currentTime + 5));
      } else if (e.altKey && e.key === "ArrowLeft") {
        handled();
        handleSeek(Math.max(0, currentTime - 5));
      } else if (mod && e.key === "ArrowUp") {
        handled();
        handleSetVolume(Math.min(1, audioSettings.volume + 0.05));
      } else if (mod && e.key === "ArrowDown") {
        handled();
        handleSetVolume(Math.max(0, audioSettings.volume - 0.05));
      } else if (mod && key === "m") {
        handled();
        handleToggleMute();
      } else if (mod && key === "s") {
        handled();
        handleToggleShuffle();
      } else if (mod && key === "r") {
        handled();
        handleCycleRepeat();
      } else if (mod && key === "l") {
        handled();
        setNowPlaying((np) => (np ? null : { panel: "lyrics" }));
      } else if (mod && key === "e") {
        handled();
        setShowEqualizer((v) => !v);
      } else if ((mod && key === "f") || e.key === "/") {
        handled();
        setNowPlaying(null);
        if (!["songs", "albums", "artists", "favorites", "recent", "playlist"].includes(route.kind)) navigate({ kind: "songs" });
        requestAnimationFrame(() => searchRef.current?.focus());
      } else if (e.key === "?") {
        handled();
        setShowShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------- Derived views

  const q = query.trim().toLowerCase();
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const artists = useMemo(() => groupArtists(tracks), [tracks]);
  const favoritesCount = useMemo(() => tracks.filter((t) => t.isFavorite).length, [tracks]);
  const needsReconnect = folders.some((f) => folderAccess[f.id] === false);

  const trackActions: TrackActions = {
    onPlay: (track, list) => playList(list, Math.max(0, list.indexOf(track))),
    onToggleFavorite: toggleFavorite,
    onPlayNext: playNext,
    onAddToQueue: addToQueue,
    onShowInfo: setInfoTrack,
    onRemove: removeTrack,
    onGoToAlbum: (t) => navigate({ kind: "album", key: albumKey(t) }),
    onGoToArtist: (t) => navigate({ kind: "artist", name: t.artist }),
  };

  const list = (items: Track[], variant: "library" | "album" = "library") => (
    <div className="px-2 md:px-5">
      <TrackList tracks={items} currentTrackId={currentTrack?.id} isPlaying={isPlaying} variant={variant} {...trackActions} />
    </div>
  );

  const noMatches = (
    <EmptyState icon={<Music2 size={24} />} title="No matches" body={`Nothing in your library matches “${query}”.`} />
  );

  const trackPage = (title: string, items: Track[], opts: { eyebrow?: string; empty?: React.ReactNode; sortable?: boolean; extra?: React.ReactNode } = {}) => {
    const sorted = opts.sortable === false ? items : sortTracks(items, sort);
    const shown = q ? sorted.filter((t) => matchesQuery(t, q)) : sorted;
    return (
      <>
        <PageHeader
          title={title}
          eyebrow={opts.eyebrow}
          meta={items.length ? `${items.length} ${items.length === 1 ? "song" : "songs"} · ${totalDuration(items)}` : undefined}
          actions={
            items.length > 0 ? (
              <PlayActions onPlay={() => playList(shown)} onShuffle={() => playList(shown, 0, true)} disabled={!shown.length} extra={opts.extra} />
            ) : (
              opts.extra
            )
          }
        />
        {items.length === 0 ? (
          opts.empty
        ) : (
          <>
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder={`Search ${title.toLowerCase()}`}
              sort={opts.sortable === false ? undefined : sort}
              onSort={setSort}
              searchRef={searchRef}
            />
            {shown.length ? list(shown) : noMatches}
          </>
        )}
      </>
    );
  };

  const renderView = () => {
    if (!ready) return null;
    if (tracks.length === 0 && route.kind !== "sources") {
      return (
        <Welcome
          canLinkFolder={supportsFolderLinking}
          onLinkFolder={() => linkFolder()}
          onImportFolder={() => folderInputRef.current?.click()}
          onImportFiles={() => filesInputRef.current?.click()}
        />
      );
    }

    switch (route.kind) {
      case "songs":
        return trackPage("Songs", tracks);

      case "favorites":
        return trackPage(
          "Favorites",
          tracks.filter((t) => t.isFavorite),
          {
            empty: <EmptyState icon={<Music2 size={24} />} title="No favorites yet" body="Tap the heart on any song and it lands here." />,
          },
        );

      case "recent":
        return trackPage("Recently added", sortTracks(tracks, "dateAdded").slice(0, 300), { sortable: false });

      case "playlist": {
        const pl = playlists.find((p) => p.id === route.id);
        if (!pl) return <EmptyState icon={<ListMusic size={24} />} title="Playlist not found" body="It may have been deleted." />;
        const items = pl.isSmart && pl.rule ? getTracksForSmartPlaylist(tracks, pl.rule) : tracks.filter((t) => pl.trackIds.includes(t.id));
        return trackPage(pl.name, items, {
          eyebrow: pl.isSmart ? "Smart playlist" : "Playlist",
          sortable: !pl.isSmart,
          empty: <EmptyState icon={<ListMusic size={24} />} title="Nothing matches yet" body="Songs show up here as soon as they match this playlist's rules." />,
          extra: (
            <IconButton
              label="Delete playlist"
              size="lg"
              onClick={async () => {
                if (!window.confirm(`Delete “${pl.name}”? Your songs stay in the library.`)) return;
                await deletePlaylist(pl.id);
                setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
                navigate({ kind: "songs" });
              }}
            >
              <Trash2 size={19} />
            </IconButton>
          ),
        });
      }

      case "albums": {
        const shown = q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : albums;
        return (
          <>
            <PageHeader title="Albums" meta={`${albums.length} albums`} />
            <Toolbar query={query} onQuery={setQuery} placeholder="Search albums" searchRef={searchRef} />
            {shown.length ? (
              <AlbumGrid albums={shown} onOpen={(a) => navigate({ kind: "album", key: a.key })} onPlay={(a) => playList(a.tracks)} />
            ) : (
              noMatches
            )}
          </>
        );
      }

      case "album": {
        const album = albums.find((a) => a.key === route.key);
        if (!album) return <EmptyState icon={<Disc3 size={24} />} title="Album not found" body="Its songs may have been removed." />;
        return (
          <>
            <PageHeader
              onBack={() => window.history.back()}
              eyebrow="Album"
              title={album.title}
              art={<Artwork src={album.cover} seed={album.title} className="size-52 shadow-2xl shadow-black/60 md:size-56" rounded="rounded-xl" iconSize={56} />}
              meta={
                <>
                  <button onClick={() => navigate({ kind: "artist", name: album.tracks[0].artist })} className="font-semibold text-fg hover:underline">
                    {album.artist}
                  </button>
                  {album.year ? ` · ${album.year}` : ""} · {album.tracks.length} {album.tracks.length === 1 ? "song" : "songs"}, {totalDuration(album.tracks)}
                </>
              }
              actions={<PlayActions onPlay={() => playList(album.tracks)} onShuffle={() => playList(album.tracks, 0, true)} />}
            />
            <div className="h-6" />
            {list(album.tracks, "album")}
          </>
        );
      }

      case "artists": {
        const shown = q ? artists.filter((a) => a.name.toLowerCase().includes(q)) : artists;
        return (
          <>
            <PageHeader title="Artists" meta={`${artists.length} artists`} />
            <Toolbar query={query} onQuery={setQuery} placeholder="Search artists" searchRef={searchRef} />
            {shown.length ? <ArtistGrid artists={shown} onOpen={(a) => navigate({ kind: "artist", name: a.name })} /> : noMatches}
          </>
        );
      }

      case "artist": {
        const artist = artists.find((a) => a.name === route.name);
        if (!artist) return <EmptyState icon={<Users size={24} />} title="Artist not found" body="Their songs may have been removed." />;
        const artistAlbums: Album[] = groupAlbums(artist.tracks);
        const songs = sortTracks(artist.tracks, "album");
        return (
          <>
            <PageHeader
              onBack={() => window.history.back()}
              eyebrow="Artist"
              title={artist.name}
              art={<Artwork src={artist.cover} seed={artist.name} className="size-44 shadow-2xl shadow-black/60 md:size-52" rounded="rounded-full" iconSize={48} />}
              meta={`${artistAlbums.length} ${artistAlbums.length === 1 ? "album" : "albums"} · ${songs.length} ${songs.length === 1 ? "song" : "songs"}`}
              actions={<PlayActions onPlay={() => playList(songs)} onShuffle={() => playList(songs, 0, true)} />}
            />
            {artistAlbums.length > 1 && (
              <>
                <h2 className="px-4 pt-10 pb-3 text-xl font-bold tracking-tight md:px-8">Albums</h2>
                <AlbumGrid albums={artistAlbums} onOpen={(a) => navigate({ kind: "album", key: a.key })} onPlay={(a) => playList(a.tracks)} />
              </>
            )}
            <h2 className="px-4 pt-8 pb-1 text-xl font-bold tracking-tight md:px-8">Songs</h2>
            {list(songs)}
          </>
        );
      }

      case "playlists":
        return (
          <>
            <PageHeader title="Playlists" />
            <PlaylistsIndex
              playlists={playlists}
              favoritesCount={favoritesCount}
              recentCount={Math.min(tracks.length, 300)}
              onOpenFavorites={() => navigate({ kind: "favorites" })}
              onOpenRecent={() => navigate({ kind: "recent" })}
              onOpenPlaylist={(id) => navigate({ kind: "playlist", id })}
              onCreate={() => setShowSmartPlaylist(true)}
              onOpenSources={() => navigate({ kind: "sources" })}
              needsReconnect={needsReconnect}
            />
          </>
        );

      case "sources":
        return (
          <SourcesView
            folders={folders.map((folder) => ({
              folder,
              granted: folderAccess[folder.id] !== false,
              trackCount: tracks.filter((t) => t.folderId === folder.id).length,
            }))}
            importedCount={tracks.filter((t) => t.source !== "folder").length}
            storage={storage}
            canLinkFolder={supportsFolderLinking}
            scanning={scanning}
            onLinkFolder={() => linkFolder()}
            onImportFolder={() => folderInputRef.current?.click()}
            onImportFiles={() => filesInputRef.current?.click()}
            onReconnect={reconnectFolder}
            onRescan={(f) => runScan(f)}
            onUnlink={unlinkFolder}
            onClearImported={clearImported}
          />
        );
    }
  };

  const tabs: { label: string; icon: React.ReactNode; route: Route; match: Route["kind"][] }[] = [
    { label: "Songs", icon: <Music2 size={22} />, route: { kind: "songs" }, match: ["songs"] },
    { label: "Albums", icon: <Disc3 size={22} />, route: { kind: "albums" }, match: ["albums", "album"] },
    { label: "Artists", icon: <Users size={22} />, route: { kind: "artists" }, match: ["artists", "artist"] },
    { label: "Library", icon: <Library size={22} />, route: { kind: "playlists" }, match: ["playlists", "playlist", "favorites", "recent", "sources"] },
  ];

  const disconnected = folders.filter((f) => folderAccess[f.id] === false);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-bg text-fg"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex min-h-0 flex-1">
        <Sidebar
          route={route}
          onNavigate={navigate}
          playlists={playlists}
          counts={{ songs: tracks.length, favorites: favoritesCount }}
          onAddMusic={() => setShowAddMusic(true)}
          onCreatePlaylist={() => setShowSmartPlaylist(true)}
          needsReconnect={needsReconnect}
        />

        <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {/* Tint from the playing artwork */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-[0.16] transition-[background] duration-700"
            style={{ background: "linear-gradient(to bottom, var(--accent), transparent)" }}
            aria-hidden="true"
          />

          <div className="relative">
            {/* Phone app bar */}
            <div className="pt-safe sticky top-0 z-20 flex h-14 items-center gap-2 bg-bg/80 px-4 backdrop-blur-xl md:hidden">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-fg">
                <AudioLines size={16} strokeWidth={2.4} />
              </span>
              <span className="flex-1 font-bold tracking-tight">HighFi</span>
              <IconButton label="Music sources" onClick={() => navigate({ kind: "sources" })}>
                <FolderOpen size={19} />
                {needsReconnect && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-400" />}
              </IconButton>
              <IconButton label="Add music" onClick={() => setShowAddMusic(true)} className="text-fg">
                <Plus size={22} />
              </IconButton>
            </div>

            {disconnected.length > 0 && route.kind !== "sources" && (
              <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 md:mx-8">
                <TriangleAlert size={18} className="shrink-0 text-amber-300" />
                <p className="min-w-0 flex-1 text-sm">
                  {disconnected.length === 1 ? `“${disconnected[0].name}” needs` : `${disconnected.length} folders need`} permission again to play.
                </p>
                <button
                  onClick={() => disconnected.forEach(reconnectFolder)}
                  className="h-8 shrink-0 rounded-full bg-amber-300 px-4 text-[13px] font-semibold text-black hover:bg-amber-200"
                >
                  Reconnect
                </button>
              </div>
            )}

            <div className="pb-6">{renderView()}</div>
          </div>
        </main>
      </div>

      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        shuffle={shuffle}
        repeatMode={repeatMode}
        volume={audioSettings.volume}
        isMuted={audioSettings.isMuted}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        onSetVolume={handleSetVolume}
        onToggleMute={handleToggleMute}
        onToggleFavorite={toggleFavorite}
        onOpenNowPlaying={(panel) => setNowPlaying({ panel })}
        onOpenEqualizer={() => setShowEqualizer(true)}
      />

      <nav className="pb-safe flex shrink-0 border-t border-line bg-surface/95 backdrop-blur-xl md:hidden" aria-label="Sections">
        {tabs.map((tab) => {
          const active = tab.match.includes(route.kind);
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.route)}
              aria-current={active ? "page" : undefined}
              className={cx("flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-fg" : "text-faint")}
            >
              <span className={active ? "text-accent" : ""}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,380px)] -translate-x-1/2 animate-sheet-in rounded-2xl border border-line-strong bg-overlay/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur md:right-6 md:bottom-24 md:left-auto md:translate-x-0"
        >
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm">
              {toast.text}
              {toast.progress && toast.progress.total > 0 && (
                <span className="text-muted">
                  {" "}
                  · {toast.progress.done} / {toast.progress.total}
                </span>
              )}
            </p>
            {toast.action && (
              <button onClick={toast.action.run} className="text-sm font-semibold text-accent">
                {toast.action.label}
              </button>
            )}
          </div>
          {toast.progress && (
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cx("h-full rounded-full bg-accent transition-[width]", !toast.progress.total && "w-1/3 animate-pulse")}
                style={toast.progress.total ? { width: `${(toast.progress.done / toast.progress.total) * 100}%` } : undefined}
              />
            </div>
          )}
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-black/70 p-6 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-accent/60 px-16 py-14 text-center">
            <Upload size={40} className="text-accent" />
            <p className="mt-4 text-xl font-bold">Drop to add music</p>
            <p className="mt-1 text-sm text-muted">
              {supportsFolderLinking ? "Folders are linked, files are imported." : "Files and folders are imported into the app."}
            </p>
          </div>
        </div>
      )}

      <input
        ref={filesInputRef}
        type="file"
        multiple
        accept="audio/*,.flac,.wav,.aif,.aiff,.m4a,.alac,.dsf,.dff,.ogg,.opus,.mp3,.lrc"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) addImported(files.map((file) => ({ file })));
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "" } as Record<string, string>)}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) addImported(files.map((file) => ({ file, relPath: file.webkitRelativePath || file.name })));
        }}
      />

      {nowPlaying && (
        <NowPlaying
          initialPanel={nowPlaying.panel}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          shuffle={shuffle}
          repeatMode={repeatMode}
          volume={audioSettings.volume}
          isMuted={audioSettings.isMuted}
          queue={queue}
          currentIndex={currentIndex}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={handleSeek}
          onToggleShuffle={handleToggleShuffle}
          onCycleRepeat={handleCycleRepeat}
          onSetVolume={handleSetVolume}
          onToggleMute={handleToggleMute}
          onClose={() => setNowPlaying(null)}
          onToggleFavorite={toggleFavorite}
          onOpenEqualizer={() => setShowEqualizer(true)}
          onShowInfo={setInfoTrack}
          onUpdateLyrics={updateLyrics}
          onPlayIndex={(i) => playTrackAtIndex(i)}
          onRemoveIndex={removeFromQueue}
          onClearUpcoming={() => setQueue((q) => q.slice(0, currentIndex + 1))}
          onShuffleUpcoming={() =>
            setQueue((q) => {
              const upcoming = q.slice(currentIndex + 1);
              for (let i = upcoming.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
              }
              return [...q.slice(0, currentIndex + 1), ...upcoming];
            })
          }
        />
      )}

      {showEqualizer && (
        <EqualizerModal
          onClose={() => setShowEqualizer(false)}
          settings={audioSettings}
          onUpdateSettings={(patch) => setAudioSettings((prev) => ({ ...prev, ...patch }))}
        />
      )}
      {infoTrack && <TrackInfoModal track={infoTrack} folders={folders} onClose={() => setInfoTrack(null)} />}
      {showSmartPlaylist && (
        <SmartPlaylistModal
          tracks={tracks}
          onClose={() => setShowSmartPlaylist(false)}
          onSave={async (pl) => {
            await savePlaylist(pl);
            setPlaylists((prev) => [...prev, pl]);
            navigate({ kind: "playlist", id: pl.id });
          }}
        />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showAddMusic && (
        <AddMusicModal
          canLinkFolder={supportsFolderLinking}
          onClose={() => setShowAddMusic(false)}
          onLinkFolder={() => linkFolder()}
          onImportFolder={() => folderInputRef.current?.click()}
          onImportFiles={() => filesInputRef.current?.click()}
        />
      )}
    </div>
  );
}
