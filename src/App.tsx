/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Track,
  Playlist,
  RepeatMode,
  AudioEngineSettings,
  SyncedLyricLine,
  AudioFormat,
} from './types/music';
import { audioEngine } from './services/audioEngine';
import {
  getAllTracks,
  saveTracks,
  saveTrack,
  updateTrack,
  deleteTrack,
  getTrackAudioBlob,
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
  hasSeededDemoContent,
  markDemoContentSeeded,
} from './services/db';
import { INITIAL_DEMO_TRACKS, INITIAL_SMART_PLAYLISTS } from './services/demoTracks';
import {
  autoGenerateSmartPlaylistsFromLibrary,
  getTracksForSmartPlaylist,
} from './services/smartPlaylists';
import { parseAudioFile } from './services/audioMetadata';
import { parseLrc } from './services/lrcParser';

// Components
import { MacTitleBar } from './components/MacTitleBar';
import { Sidebar } from './components/Sidebar';
import { TrackListView } from './components/TrackListView';
import { PlayerBottomBar } from './components/PlayerBottomBar';
import { SyncedLyricsView } from './components/SyncedLyricsView';
import { EqualizerModal } from './components/EqualizerModal';
import { AudioInspectorModal } from './components/AudioInspectorModal';
import { SmartPlaylistModal } from './components/SmartPlaylistModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { QueueDrawer } from './components/QueueDrawer';
import { VisualizerCanvas } from './components/VisualizerCanvas';

export default function App() {
  // Library & Playlists State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentView, setCurrentView] = useState<string>('all');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Playback State
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [shuffleHistory, setShuffleHistory] = useState<number[]>([]);

  // DSP & Engine Settings
  const [audioSettings, setAudioSettings] = useState<AudioEngineSettings>(() =>
    audioEngine.getSettings()
  );

  // UI Views & Modals
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [showQueue, setShowQueue] = useState<boolean>(false);
  const [showVisualizer, setShowVisualizer] = useState<boolean>(true);
  const [showEqualizerModal, setShowEqualizerModal] = useState<boolean>(false);
  const [showInspectorModal, setShowInspectorModal] = useState<boolean>(false);
  const [showSmartPlaylistModal, setShowSmartPlaylistModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [inspectedTrack, setInspectedTrack] = useState<Track | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentTrack: Track | null =
    currentQueueIndex >= 0 && currentQueueIndex < queue.length ? queue[currentQueueIndex] : null;

  // The engine stores exactly one callback per event, so it must be wired up
  // once on mount. These refs hold the freshest handler for each event, which
  // keeps the engine from invoking a closure over stale queue/repeat state.
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const handlePlayPauseRef = useRef<() => void>(() => {});
  const handleNextTrackRef = useRef<() => void>(() => {});
  const handlePrevTrackRef = useRef<() => void>(() => {});
  const handleSeekRef = useRef<(to: number) => void>(() => {});

  // 1. Initialize Database & Demo Audio Offline
  useEffect(() => {
    let mounted = true;

    async function initDB() {
      try {
        // Demo content is seeded exactly once. Without this flag an empty
        // library looks identical to a first run, so deleting every track
        // would resurrect the whole demo set on the next refresh.
        const hasSeeded = hasSeededDemoContent();

        let loadedTracks = await getAllTracks();
        let loadedPlaylists = await getAllPlaylists();

        if (!hasSeeded) {
          if (loadedTracks.length === 0) {
            // Preload audiophile demo masters
            await saveTracks(INITIAL_DEMO_TRACKS);
            loadedTracks = INITIAL_DEMO_TRACKS;
          }

          if (loadedPlaylists.length === 0) {
            for (const pl of INITIAL_SMART_PLAYLISTS) {
              await savePlaylist(pl);
            }
            loadedPlaylists = INITIAL_SMART_PLAYLISTS;
          }

          markDemoContentSeeded();
        }

        if (mounted) {
          setTracks(loadedTracks);
          setPlaylists(loadedPlaylists);
          setQueue(loadedTracks);
          setCurrentQueueIndex(0);
        }
      } catch (err) {
        console.error('Error initializing audio DB:', err);
        // Fallback in-memory
        if (mounted) {
          setTracks(INITIAL_DEMO_TRACKS);
          setPlaylists(INITIAL_SMART_PLAYLISTS);
          setQueue(INITIAL_DEMO_TRACKS);
          setCurrentQueueIndex(0);
        }
      }
    }

    initDB();

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Setup Audio Engine Listeners + macOS MediaSession actions.
  // Registered once; every handler dispatches through a ref so it always runs
  // the current version without re-registering (the engine has no removal API).
  useEffect(() => {
    audioEngine.onTimeUpdate((time, dur) => {
      setCurrentTime(time);
      if (dur > 0) setDuration(dur);
    });

    audioEngine.onStateChange((playing) => {
      setIsPlaying(playing);
    });

    audioEngine.onEnded(() => {
      handleTrackEndedRef.current();
    });

    audioEngine.registerMediaSessionHandlers({
      play: () => handlePlayPauseRef.current(),
      pause: () => handlePlayPauseRef.current(),
      prev: () => handlePrevTrackRef.current(),
      next: () => handleNextTrackRef.current(),
      seek: (to) => handleSeekRef.current(to),
    });
  }, []);

  // Track playback transition
  const playTrackAtIndex = useCallback(
    async (index: number, fromQueue?: Track[]) => {
      // Callers that have just replaced the queue pass it in explicitly, since
      // the state update has not been applied to this closure yet.
      const activeQueue = fromQueue ?? queue;
      if (index < 0 || index >= activeQueue.length) return;
      const trackToPlay = activeQueue[index];
      setCurrentQueueIndex(index);

      // Check if we need to hydrate the Blob from IDB
      let fullTrack = trackToPlay;
      if (!fullTrack.audioBlob && !fullTrack.audioUrl) {
        const storedBlob = await getTrackAudioBlob(fullTrack.id);
        if (storedBlob) {
          fullTrack = { ...fullTrack, audioBlob: storedBlob };
        }
      }

      await audioEngine.loadTrack(fullTrack, true);
      setIsPlaying(true);

      // Increment play count in IDB
      const updatedCount = (fullTrack.playCount || 0) + 1;
      updateTrack(fullTrack.id, { playCount: updatedCount });
      setTracks((prev) =>
        prev.map((t) => (t.id === fullTrack.id ? { ...t, playCount: updatedCount } : t))
      );
    },
    [queue]
  );

  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'one') {
      audioEngine.seek(0);
      audioEngine.play();
      return;
    }

    if (shuffle) {
      // Pick random index from unplayed tracks
      const unplayed = queue
        .map((_, idx) => idx)
        .filter((idx) => !shuffleHistory.includes(idx) && idx !== currentQueueIndex);

      if (unplayed.length > 0) {
        const nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)];
        setShuffleHistory((prev) => [...prev, currentQueueIndex]);
        playTrackAtIndex(nextIdx);
        return;
      } else {
        // All played; reset history
        setShuffleHistory([]);
        if (repeatMode === 'all') {
          const nextIdx = Math.floor(Math.random() * queue.length);
          playTrackAtIndex(nextIdx);
          return;
        }
      }
    } else {
      if (currentQueueIndex + 1 < queue.length) {
        playTrackAtIndex(currentQueueIndex + 1);
        return;
      } else if (repeatMode === 'all' && queue.length > 0) {
        playTrackAtIndex(0);
        return;
      }
    }

    setIsPlaying(false);
  }, [currentQueueIndex, queue, repeatMode, shuffle, shuffleHistory, playTrackAtIndex]);

  const handleNextTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      playTrackAtIndex(nextIdx);
    } else {
      const nextIdx = (currentQueueIndex + 1) % queue.length;
      playTrackAtIndex(nextIdx);
    }
  }, [currentQueueIndex, queue, shuffle, playTrackAtIndex]);

  const handlePrevTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (currentTime > 3) {
      // Restart current track if played > 3 seconds
      audioEngine.seek(0);
      return;
    }

    const prevIdx = (currentQueueIndex - 1 + queue.length) % queue.length;
    playTrackAtIndex(prevIdx);
  }, [currentQueueIndex, queue, currentTime, playTrackAtIndex]);

  const handlePlayPause = useCallback(async () => {
    if (!currentTrack) {
      if (queue.length > 0) {
        await playTrackAtIndex(0);
      }
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      return;
    }

    // On a fresh load the queue is populated but nothing has been handed to the
    // engine yet, so the first press has to load the track rather than resume.
    if (audioEngine.getLoadedTrackId() !== currentTrack.id) {
      await playTrackAtIndex(currentQueueIndex >= 0 ? currentQueueIndex : 0);
      return;
    }

    await audioEngine.play();
    setIsPlaying(true);
  }, [currentTrack, currentQueueIndex, isPlaying, queue, playTrackAtIndex]);

  const handleSeek = useCallback((seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  }, []);

  // Keep the engine-facing refs pointed at the current handlers.
  useEffect(() => {
    handleTrackEndedRef.current = handleTrackEnded;
    handlePlayPauseRef.current = handlePlayPause;
    handleNextTrackRef.current = handleNextTrack;
    handlePrevTrackRef.current = handlePrevTrack;
    handleSeekRef.current = handleSeek;
  }, [handleTrackEnded, handlePlayPause, handleNextTrack, handlePrevTrack, handleSeek]);

  const handleSetVolume = (vol: number) => {
    audioEngine.setVolume(vol);
    setAudioSettings((prev) => ({ ...prev, volume: vol, isMuted: false }));
  };

  const handleToggleMute = () => {
    const newMuted = !audioSettings.isMuted;
    audioEngine.setMuted(newMuted);
    setAudioSettings((prev) => ({ ...prev, isMuted: newMuted }));
  };

  const handleToggleShuffle = () => {
    setShuffle((prev) => !prev);
    setShuffleHistory([]);
  };

  const handleCycleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const handleToggleSpatialAudio = () => {
    const nextVal = !audioSettings.isSpatialAudioEnabled;
    audioEngine.setSpatialAudioEnabled(nextVal);
    setAudioSettings((prev) => ({ ...prev, isSpatialAudioEnabled: nextVal }));
  };

  const handleToggleFavorite = async (trackId: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;
    const nextFav = !target.isFavorite;

    await updateTrack(trackId, { isFavorite: nextFav });
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: nextFav } : t))
    );
    setQueue((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: nextFav } : t))
    );
  };

  /**
   * Permanently removes a track: its metadata row, its audio blob, and any
   * references held by manual playlists. Smart playlists re-evaluate from the
   * library, so they need no cleanup.
   */
  const handleRemoveTrack = useCallback(
    async (trackId: string) => {
      const target = tracks.find((t) => t.id === trackId);

      await deleteTrack(trackId);

      // Release the object URL for cover art extracted from an ID3 tag.
      if (target?.coverArtUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.coverArtUrl);
      }

      setTracks((prev) => prev.filter((t) => t.id !== trackId));

      const removeIndex = queue.findIndex((t) => t.id === trackId);
      if (removeIndex !== -1) {
        const nextQueue = queue.filter((t) => t.id !== trackId);
        setQueue(nextQueue);

        if (removeIndex === currentQueueIndex) {
          // The playing track just disappeared: stop rather than surprising the
          // listener with whatever happens to fall into its slot.
          audioEngine.pause();
          setIsPlaying(false);
          setCurrentTime(0);

          const nextIndex =
            nextQueue.length === 0 ? -1 : Math.min(currentQueueIndex, nextQueue.length - 1);
          setCurrentQueueIndex(nextIndex);
          // Cue the transport to whatever track took the slot, so the progress
          // bar does not keep showing the removed track's length.
          setDuration(nextIndex === -1 ? 0 : nextQueue[nextIndex].duration);
        } else if (removeIndex < currentQueueIndex) {
          setCurrentQueueIndex((prev) => prev - 1);
        }

        setShuffleHistory([]);
      }

      // Drop the id from manual playlists so nothing persists a dangling ref.
      const affected = playlists.filter(
        (pl) => !pl.isSmart && pl.trackIds.includes(trackId)
      );
      if (affected.length > 0) {
        const updated = affected.map((pl) => ({
          ...pl,
          trackIds: pl.trackIds.filter((id) => id !== trackId),
          updatedAt: Date.now(),
        }));
        await Promise.all(updated.map((pl) => savePlaylist(pl)));
        setPlaylists((prev) =>
          prev.map((pl) => updated.find((u) => u.id === pl.id) ?? pl)
        );
      }

      // Close the inspector if it was showing the track we just removed.
      setInspectedTrack((prev) => (prev?.id === trackId ? null : prev));
      if (inspectedTrack?.id === trackId) {
        setShowInspectorModal(false);
      }
    },
    [tracks, queue, currentQueueIndex, playlists, inspectedTrack]
  );

  const handleUpdateLyrics = async (
    trackId: string,
    lyrics: SyncedLyricLine[],
    rawLrc: string
  ) => {
    await updateTrack(trackId, { lyrics, rawLrc });
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, lyrics, rawLrc } : t))
    );
    setQueue((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, lyrics, rawLrc } : t))
    );
  };

  // 4. Native macOS Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      // Escape closes modals or lyrics
      if (e.key === 'Escape') {
        if (showEqualizerModal) setShowEqualizerModal(false);
        else if (showInspectorModal) setShowInspectorModal(false);
        else if (showSmartPlaylistModal) setShowSmartPlaylistModal(false);
        else if (showShortcutsModal) setShowShortcutsModal(false);
        else if (showLyrics) setShowLyrics(false);
        else if (showQueue) setShowQueue(false);
        return;
      }

      // Ignore standard letter keys when user is typing in search or lyrics editor
      if (isInput) return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isAlt = e.altKey;

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      // ⌘ + → : Next track
      else if (isCmdOrCtrl && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextTrack();
      }
      // ⌘ + ← : Previous track
      else if (isCmdOrCtrl && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevTrack();
      }
      // ⌥ + → : Seek forward 5s
      else if (isAlt && e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeek(Math.min(duration, currentTime + 5));
      }
      // ⌥ + ← : Seek backward 5s
      else if (isAlt && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 5));
      }
      // ⌘ + ↑ : Volume up
      else if (isCmdOrCtrl && e.key === 'ArrowUp') {
        e.preventDefault();
        handleSetVolume(Math.min(1, audioSettings.volume + 0.05));
      }
      // ⌘ + ↓ : Volume down
      else if (isCmdOrCtrl && e.key === 'ArrowDown') {
        e.preventDefault();
        handleSetVolume(Math.max(0, audioSettings.volume - 0.05));
      }
      // ⌘ + M : Mute
      else if (isCmdOrCtrl && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        handleToggleMute();
      }
      // ⌘ + S : Toggle Shuffle
      else if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleToggleShuffle();
      }
      // ⌘ + R : Cycle Repeat mode (prevent browser page reload)
      else if (isCmdOrCtrl && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        handleCycleRepeat();
      }
      // ⌘ + L : Toggle Synced Lyrics view
      else if (isCmdOrCtrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
      }
      // ⌘ + E : Toggle Equalizer
      else if (isCmdOrCtrl && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setShowEqualizerModal((prev) => !prev);
      }
      // ⌘ + F or '/' : Search library
      else if ((isCmdOrCtrl && (e.key === 'f' || e.key === 'F')) || e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F or ⌘ + Enter : Fullscreen
      else if (
        (!isCmdOrCtrl && !isAlt && (e.key === 'f' || e.key === 'F')) ||
        (isCmdOrCtrl && e.key === 'Enter')
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
      // '?' : Shortcuts
      else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlayPause,
    handleNextTrack,
    handlePrevTrack,
    currentTime,
    duration,
    audioSettings.volume,
    audioSettings.isMuted,
    showLyrics,
    showEqualizerModal,
    showInspectorModal,
    showSmartPlaylistModal,
    showShortcutsModal,
    showQueue,
  ]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 5. Handle File Uploads & Drag-and-Drop
  const handleFiles = async (fileList: FileList) => {
    const audioFiles: File[] = [];
    const lrcFiles: File[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'lrc' || ext === 'txt') {
        lrcFiles.push(file);
      } else {
        audioFiles.push(file);
      }
    }

    const newTracks: Track[] = [];

    for (const file of audioFiles) {
      try {
        const metadata = await parseAudioFile(file);
        const trackId = `track-local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const fullTrack: Track = {
          id: trackId,
          title: metadata.title || file.name,
          artist: metadata.artist || 'Local Master',
          album: metadata.album || 'Hi-Res Library',
          duration: metadata.duration || 180,
          format: (metadata.format as AudioFormat) || 'FLAC',
          sampleRate: metadata.sampleRate || 96000,
          bitDepth: metadata.bitDepth || 24,
          channels: metadata.channels || 2,
          bitrate: metadata.bitrate || 2822,
          genre: metadata.genre || 'Lossless',
          coverArtUrl:
            metadata.coverArtUrl ||
            INITIAL_DEMO_TRACKS[Math.floor(Math.random() * INITIAL_DEMO_TRACKS.length)].coverArtUrl,
          audioBlob: file,
          playCount: 0,
          dateAdded: Date.now(),
          isHiRes: metadata.isHiRes ?? true,
          fileSize: file.size,
          filePath: file.name,
        };

        // Check if there is an accompanying LRC file matching this track's name
        const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const matchingLrc = lrcFiles.find((lf) =>
          lf.name.toLowerCase().includes(baseName)
        );
        if (matchingLrc) {
          const lrcText = await matchingLrc.text();
          const parsed = parseLrc(lrcText);
          fullTrack.lyrics = parsed.lyrics;
          fullTrack.rawLrc = lrcText;
        }

        await saveTrack(fullTrack);
        newTracks.push(fullTrack);
      } catch (err) {
        console.error('Failed to parse dropped audio file:', file.name, err);
      }
    }

    // If an LRC file was dropped independently and we have a current track, apply to current track
    if (audioFiles.length === 0 && lrcFiles.length > 0 && currentTrack) {
      const lrcText = await lrcFiles[0].text();
      const parsed = parseLrc(lrcText);
      await handleUpdateLyrics(currentTrack.id, parsed.lyrics, lrcText);
      setShowLyrics(true);
    }

    if (newTracks.length > 0) {
      const nextQueue = [...newTracks, ...queue];
      setTracks((prev) => [...newTracks, ...prev]);
      setQueue(nextQueue);
      // Play the newly added track against the queue we just built, not the
      // stale one captured by playTrackAtIndex.
      playTrackAtIndex(0, nextQueue);
    }
  };

  // 6. Smart Playlists & Filtering Calculations
  const getDisplayedTracks = (): Track[] => {
    let list: Track[] = tracks;

    if (selectedPlaylistId) {
      const pl = playlists.find((p) => p.id === selectedPlaylistId);
      if (pl) {
        if (pl.isSmart && pl.rule) {
          list = getTracksForSmartPlaylist(tracks, pl.rule);
        } else {
          list = tracks.filter((t) => pl.trackIds.includes(t.id));
        }
      }
    } else {
      if (currentView === 'hires') {
        list = tracks.filter((t) => t.isHiRes);
      } else if (currentView === 'favorites') {
        list = tracks.filter((t) => t.isFavorite);
      }
    }

    // Format Filter Pills
    if (formatFilter !== 'all') {
      if (formatFilter === 'hires') {
        list = list.filter((t) => t.isHiRes);
      } else {
        list = list.filter((t) => t.format.toLowerCase() === formatFilter.toLowerCase());
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          t.format.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const displayedTracks = getDisplayedTracks();

  const handlePlayAll = (targetTracks: Track[], shuffleMode: boolean) => {
    if (targetTracks.length === 0) return;
    setQueue(targetTracks);
    setShuffle(shuffleMode);
    setShuffleHistory([]);

    const startIndex = shuffleMode ? Math.floor(Math.random() * targetTracks.length) : 0;
    // Goes through playTrackAtIndex so the blob is hydrated from IndexedDB and
    // the play count is recorded, same as any other playback entry point.
    playTrackAtIndex(startIndex, targetTracks);
  };

  const handlePlaySingleTrack = (track: Track) => {
    // If track is in current queue, switch to it
    const indexInQueue = queue.findIndex((t) => t.id === track.id);
    if (indexInQueue !== -1) {
      playTrackAtIndex(indexInQueue);
    } else {
      // Add to the front and play it
      const nextQueue = [track, ...queue];
      setQueue(nextQueue);
      playTrackAtIndex(0, nextQueue);
    }
  };

  const handleAutoGenerateSmartPlaylists = async () => {
    const generated = autoGenerateSmartPlaylistsFromLibrary(tracks);
    for (const pl of generated) {
      await savePlaylist(pl);
    }
    setPlaylists((prev) => {
      // Filter out duplicates by id
      const existingIds = new Set(prev.map((p) => p.id));
      const fresh = generated.filter((g) => !existingIds.has(g.id));
      return [...prev, ...fresh];
    });
  };

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
      setCurrentView('all');
    }
  };

  // View title helper
  const getViewTitle = () => {
    if (selectedPlaylistId) {
      const pl = playlists.find((p) => p.id === selectedPlaylistId);
      return pl?.name || 'Playlist';
    }
    if (currentView === 'hires') return 'Hi-Res Lossless Masters';
    if (currentView === 'favorites') return 'Audiophile Favorites';
    if (currentView === 'albums') return 'Albums Library';
    return 'Music Library';
  };

  const getViewSubtitle = () => {
    if (selectedPlaylistId) {
      const pl = playlists.find((p) => p.id === selectedPlaylistId);
      return pl?.description || 'Custom auto-filtered lossless audio selection';
    }
    if (currentView === 'hires')
      return 'Lossless studio masters (FLAC, WAV, DSD, ALAC) with 24-bit/96kHz+ resolution';
    if (currentView === 'favorites')
      return 'Starred reference tracks for critical listening and acoustic testing';
    return 'Complete offline collection stored locally in browser IndexedDB';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0c12] text-white">
      {/* 1. Authentic macOS Title Bar with Window Controls */}
      <MacTitleBar
        currentTrack={currentTrack}
        onOpenEqualizer={() => setShowEqualizerModal(true)}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
        onOpenInspector={() => {
          if (currentTrack) {
            setInspectedTrack(currentTrack);
            setShowInspectorModal(true);
          }
        }}
        showVisualizer={showVisualizer}
        onToggleVisualizer={() => setShowVisualizer((prev) => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* 2. Main Body Split-View */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* macOS Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          selectedPlaylistId={selectedPlaylistId}
          onSelectView={(v) => {
            setCurrentView(v);
            setSelectedPlaylistId(null);
          }}
          onSelectPlaylist={(pId) => {
            setSelectedPlaylistId(pId);
          }}
          playlists={playlists}
          tracks={tracks}
          onOpenCreateSmartPlaylist={() => setShowSmartPlaylistModal(true)}
          onAutoGenerateSmartPlaylists={handleAutoGenerateSmartPlaylists}
          onTriggerFileInput={() => fileInputRef.current?.click()}
          onDeletePlaylist={handleDeletePlaylist}
        />

        {/* Center Content: Either Synced Lyrics View or Main Track List */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {showLyrics ? (
            <SyncedLyricsView
              currentTrack={currentTrack}
              currentTime={currentTime}
              onSeek={handleSeek}
              onClose={() => setShowLyrics(false)}
              onUpdateLyrics={handleUpdateLyrics}
            />
          ) : (
            <TrackListView
              title={getViewTitle()}
              subtitle={getViewSubtitle()}
              tracks={displayedTracks}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              onPlayTrack={handlePlaySingleTrack}
              onPlayAll={handlePlayAll}
              onToggleFavorite={handleToggleFavorite}
              onRemoveTrack={handleRemoveTrack}
              onInspectTrack={(t) => {
                setInspectedTrack(t);
                setShowInspectorModal(true);
              }}
              onFilesDropped={handleFiles}
              onTriggerFileInput={() => fileInputRef.current?.click()}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              formatFilter={formatFilter}
              onFormatFilterChange={setFormatFilter}
              searchInputRef={searchInputRef}
            />
          )}

          {/* Real-time Spectrum Visualizer Bar (pinned right above player bar) */}
          {showVisualizer && (
            <div className="h-10 bg-black/40 border-t border-white/[0.04] px-4 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  REALTIME FFT SPECTRUM
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {audioSettings.isSpatialAudioEnabled ? 'Binaural 3D' : 'Stereo 2.0'}
                </span>
              </div>

              <div className="flex-1 max-w-xl mx-4">
                <VisualizerCanvas
                  mode={audioSettings.visualizerMode}
                  height={32}
                  isPlaying={isPlaying}
                />
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                <button
                  onClick={() =>
                    setAudioSettings((prev) => ({
                      ...prev,
                      visualizerMode:
                        prev.visualizerMode === 'spectrum'
                          ? 'waveform'
                          : prev.visualizerMode === 'waveform'
                          ? 'circular'
                          : 'spectrum',
                    }))
                  }
                  className="hover:text-white transition-colors cursor-pointer capitalize"
                  title="Switch visualizer rendering mode"
                >
                  [{audioSettings.visualizerMode}]
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Drawer: Playback Queue */}
        <QueueDrawer
          isOpen={showQueue}
          onClose={() => setShowQueue(false)}
          queue={queue}
          currentIndex={currentQueueIndex}
          onPlayTrackAtIndex={playTrackAtIndex}
          onClearQueue={() => setQueue(currentTrack ? [currentTrack] : [])}
          onShuffleQueue={() => {
            const upNext = queue.slice(currentQueueIndex + 1);
            const shuffled = [...upNext].sort(() => Math.random() - 0.5);
            setQueue([...queue.slice(0, currentQueueIndex + 1), ...shuffled]);
          }}
        />
      </div>

      {/* 3. Bottom HiFi Playback Controller Dock */}
      <PlayerBottomBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={audioSettings.volume}
        isMuted={audioSettings.isMuted}
        shuffle={shuffle}
        repeatMode={repeatMode}
        isSpatialAudioEnabled={audioSettings.isSpatialAudioEnabled}
        showLyrics={showLyrics}
        showQueue={showQueue}
        onPlayPause={handlePlayPause}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        onSetVolume={handleSetVolume}
        onToggleMute={handleToggleMute}
        onToggleSpatialAudio={handleToggleSpatialAudio}
        onToggleLyrics={() => setShowLyrics((prev) => !prev)}
        onToggleQueue={() => setShowQueue((prev) => !prev)}
        onOpenEqualizer={() => setShowEqualizerModal(true)}
        onOpenInspector={() => {
          if (currentTrack) {
            setInspectedTrack(currentTrack);
            setShowInspectorModal(true);
          }
        }}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Hidden File Input for Audio & LRC Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.flac,.wav,.alac,.aiff,.dsd,.dsf,.mp3,.ogg,.m4a,.lrc,.txt"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
          }
        }}
        className="hidden"
      />

      {/* 4. Modals */}
      <EqualizerModal
        isOpen={showEqualizerModal}
        onClose={() => setShowEqualizerModal(false)}
        settings={audioSettings}
        onUpdateSettings={(newSettings) =>
          setAudioSettings((prev) => ({ ...prev, ...newSettings }))
        }
      />

      <AudioInspectorModal
        isOpen={showInspectorModal}
        onClose={() => setShowInspectorModal(false)}
        track={inspectedTrack || currentTrack}
      />

      <SmartPlaylistModal
        isOpen={showSmartPlaylistModal}
        onClose={() => setShowSmartPlaylistModal(false)}
        tracks={tracks}
        onSaveSmartPlaylist={async (newPlaylist) => {
          await savePlaylist(newPlaylist);
          setPlaylists((prev) => [...prev, newPlaylist]);
          setSelectedPlaylistId(newPlaylist.id);
        }}
      />

      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
