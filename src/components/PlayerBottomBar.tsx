import React, { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  FileText,
  SlidersHorizontal,
  Heart,
  Headphones,
  ListMusic,
  ChevronDown,
  ChevronUp,
  Disc3,
} from "lucide-react";
import { RepeatMode, Track } from "../types/music";
import { Dialog } from "./Dialog";

interface PlayerBottomBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isSpatialAudioEnabled: boolean;
  showLyrics: boolean;
  showQueue: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleSpatialAudio: () => void;
  onToggleLyrics: () => void;
  onToggleQueue: () => void;
  onOpenEqualizer: () => void;
  onOpenInspector: () => void;
  onToggleFavorite: (trackId: string) => void;
}

export const PlayerBottomBar: React.FC<PlayerBottomBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeatMode,
  isSpatialAudioEnabled,
  showLyrics,
  showQueue,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onSetVolume,
  onToggleMute,
  onToggleSpatialAudio,
  onToggleLyrics,
  onToggleQueue,
  onOpenEqualizer,
  onOpenInspector,
  onToggleFavorite,
}) => {
  const [expanded, setExpanded] = useState(false);
  const formatTime = (seconds: number) =>
    `${Math.floor(Math.max(0, seconds || 0) / 60)}:${String(Math.floor(Math.max(0, seconds || 0) % 60)).padStart(2, "0")}`;
  const progress =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const playButton = (
    <button
      className="play-button"
      onClick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
      disabled={!currentTrack}
    >
      {isPlaying ? (
        <Pause size={22} fill="currentColor" />
      ) : (
        <Play size={22} fill="currentColor" />
      )}
    </button>
  );
  const transport = (
    <div className="transport-controls">
      <button
        className={`icon-button ${shuffle ? "is-active" : ""}`}
        onClick={onToggleShuffle}
        aria-label="Shuffle"
        aria-pressed={shuffle}
      >
        <Shuffle size={18} />
      </button>
      <button
        className="icon-button"
        onClick={onPrev}
        aria-label="Previous track"
      >
        <SkipBack size={20} fill="currentColor" />
      </button>
      {playButton}
      <button className="icon-button" onClick={onNext} aria-label="Next track">
        <SkipForward size={20} fill="currentColor" />
      </button>
      <button
        className={`icon-button ${repeatMode !== "off" ? "is-active" : ""}`}
        onClick={onCycleRepeat}
        aria-label={`Repeat: ${repeatMode}`}
      >
        {repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
      </button>
    </div>
  );
  const scrubber = (
    <div className="player-scrubber">
      <span>{formatTime(currentTime)}</span>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(currentTime, duration || 1)}
        disabled={!currentTrack}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Seek track position"
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
      />
      <span>{formatTime(duration || currentTrack?.duration || 0)}</span>
    </div>
  );
  const volumeControl = (
    <div className="volume-control">
      <button
        className="icon-button"
        onClick={onToggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={isMuted ? 0 : volume}
        onChange={(e) => onSetVolume(Number(e.target.value))}
        aria-label="Adjust volume"
        style={
          {
            "--progress": `${(isMuted ? 0 : volume) * 100}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
  const openTool = (action: () => void) => {
    setExpanded(false);
    action();
  };
  return (
    <>
      <footer className="player-dock" aria-label="Music player">
        <div className="mini-progress" style={{ width: `${progress}%` }} />
        <div className="player-track">
          <button
            className="player-cover"
            onClick={onOpenInspector}
            aria-label="Inspect current track"
          >
            {currentTrack?.coverArtUrl ? (
              <img src={currentTrack.coverArtUrl} alt="" />
            ) : (
              <Disc3 size={24} />
            )}
          </button>
          <button
            className="player-track-text"
            onClick={() => setExpanded(true)}
            aria-label="Open now playing"
          >
            <strong>{currentTrack?.title || "Find your next favorite"}</strong>
            <small>
              {currentTrack?.artist || "Import music to get started"}
            </small>
          </button>
          {currentTrack && (
            <button
              className={`icon-button dock-favorite ${currentTrack.isFavorite ? "favorited" : ""}`}
              onClick={() => onToggleFavorite(currentTrack.id)}
              aria-label="Favorite current track"
            >
              <Heart
                size={18}
                fill={currentTrack.isFavorite ? "currentColor" : "none"}
              />
            </button>
          )}
        </div>
        <div className="desktop-transport">
          {transport}
          {scrubber}
        </div>
        <div className="dock-tools">
          <button
            className={`icon-button ${showLyrics ? "is-active" : ""}`}
            onClick={onToggleLyrics}
            aria-label="Synced lyrics"
            title="Lyrics"
          >
            <FileText size={18} />
          </button>
          <button
            className={`icon-button ${showQueue ? "is-active" : ""}`}
            onClick={onToggleQueue}
            aria-label="Playback queue"
            title="Queue"
          >
            <ListMusic size={19} />
          </button>
          {volumeControl}
        </div>
        <div className="mobile-transport">
          {playButton}
          <button
            className="icon-button"
            onClick={onNext}
            aria-label="Next track"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className="icon-button expand-player"
            onClick={() => setExpanded(true)}
            aria-label="Expand player"
          >
            <ChevronUp size={20} />
          </button>
        </div>
      </footer>
      {expanded && (
        <Dialog
          onClose={() => setExpanded(false)}
          label="Now playing"
          className="now-playing-dialog"
        >
          <section className="now-playing">
            <div className="now-playing-heading">
              <button
                className="icon-button"
                onClick={() => setExpanded(false)}
                aria-label="Collapse player"
              >
                <ChevronDown size={23} />
              </button>
              <p className="eyebrow">NOW PLAYING</p>
              <button
                className="icon-button"
                onClick={() => openTool(onOpenInspector)}
                aria-label="Track details"
              >
                <Disc3 size={20} />
              </button>
            </div>
            <div className="now-playing-art">
              {currentTrack?.coverArtUrl ? (
                <img
                  src={currentTrack.coverArtUrl}
                  alt="Current album artwork"
                />
              ) : (
                <Disc3 size={70} />
              )}
            </div>
            <div className="now-playing-title">
              <div>
                <h2>{currentTrack?.title || "Your soundtrack starts here"}</h2>
                <p>
                  {currentTrack?.artist ||
                    "Choose a track from your collection"}
                </p>
              </div>
              {currentTrack && (
                <button
                  className={`icon-button ${currentTrack.isFavorite ? "favorited" : ""}`}
                  onClick={() => onToggleFavorite(currentTrack.id)}
                  aria-label="Favorite current track"
                >
                  <Heart
                    size={23}
                    fill={currentTrack.isFavorite ? "currentColor" : "none"}
                  />
                </button>
              )}
            </div>
            <p className="now-playing-quality">
              {currentTrack
                ? `${currentTrack.format} · ${currentTrack.bitDepth}-bit · ${(currentTrack.sampleRate / 1000).toFixed(1)} kHz`
                : "Made for listening"}
            </p>
            {scrubber}
            {transport}
            {volumeControl}
            <div className="now-playing-tools">
              <button onClick={() => openTool(onToggleLyrics)}>
                <FileText size={20} />
                Lyrics
              </button>
              <button onClick={() => openTool(onToggleQueue)}>
                <ListMusic size={20} />
                Queue
              </button>
              <button onClick={() => openTool(onOpenEqualizer)}>
                <SlidersHorizontal size={20} />
                Equalizer
              </button>
              <button
                className={isSpatialAudioEnabled ? "is-active" : ""}
                onClick={onToggleSpatialAudio}
                aria-pressed={isSpatialAudioEnabled}
              >
                <Headphones size={20} />
                Spatial
              </button>
            </div>
          </section>
        </Dialog>
      )}
    </>
  );
};
