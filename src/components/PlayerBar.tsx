import React from "react";
import {
  Heart,
  ListMusic,
  Maximize2,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { RepeatMode, Track } from "../types/music";
import { Artwork, IconButton, cx, formatTime } from "./ui";

export interface TransportProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

export function Transport({
  isPlaying,
  currentTrack,
  shuffle,
  repeatMode,
  onPlayPause,
  onNext,
  onPrev,
  onToggleShuffle,
  onCycleRepeat,
  large = false,
}: TransportProps & { large?: boolean }) {
  const skip = large ? 30 : 20;
  return (
    <div className={cx("flex items-center", large ? "w-full justify-between" : "gap-2")}>
      <IconButton label={shuffle ? "Shuffle on" : "Shuffle off"} active={shuffle} onClick={onToggleShuffle} aria-pressed={shuffle} size={large ? "lg" : "md"}>
        <Shuffle size={large ? 22 : 17} />
      </IconButton>
      <IconButton label="Previous" onClick={onPrev} disabled={!currentTrack} size={large ? "lg" : "md"} className="text-fg">
        <SkipBack size={skip} fill="currentColor" />
      </IconButton>
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cx(
          "grid shrink-0 place-items-center rounded-full bg-fg text-bg transition hover:scale-105 active:scale-95",
          large ? "size-[72px]" : "size-10",
        )}
      >
        {isPlaying ? (
          <Pause size={large ? 30 : 18} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={large ? 30 : 18} fill="currentColor" strokeWidth={0} className="ml-[3px]" />
        )}
      </button>
      <IconButton label="Next" onClick={onNext} disabled={!currentTrack} size={large ? "lg" : "md"} className="text-fg">
        <SkipForward size={skip} fill="currentColor" />
      </IconButton>
      <IconButton
        label={`Repeat: ${repeatMode}`}
        active={repeatMode !== "off"}
        onClick={onCycleRepeat}
        size={large ? "lg" : "md"}
      >
        {repeatMode === "one" ? <Repeat1 size={large ? 22 : 17} /> : <Repeat size={large ? 22 : 17} />}
      </IconButton>
    </div>
  );
}

export function Scrubber({
  currentTime,
  duration,
  onSeek,
  disabled,
  large = false,
}: {
  currentTime: number;
  duration: number;
  onSeek: (s: number) => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const slider = (
    <input
      type="range"
      className={cx("range", large && "range-thumb")}
      min={0}
      max={duration || 1}
      step={0.1}
      value={Math.min(currentTime, duration || 1)}
      disabled={disabled}
      onChange={(e) => onSeek(Number(e.target.value))}
      aria-label="Seek"
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      style={{ "--progress": `${progress}%` } as React.CSSProperties}
    />
  );
  if (large) {
    return (
      <div className="w-full">
        {slider}
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full items-center gap-2.5 text-[11px] tabular-nums text-faint">
      <span className="w-10 text-right">{formatTime(currentTime)}</span>
      {slider}
      <span className="w-10">{formatTime(duration)}</span>
    </div>
  );
}

export function VolumeControl({
  volume,
  isMuted,
  onSetVolume,
  onToggleMute,
  className = "",
}: {
  volume: number;
  isMuted: boolean;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  className?: string;
}) {
  const level = isMuted ? 0 : volume;
  return (
    <div className={cx("flex items-center gap-1", className)}>
      <IconButton label={isMuted ? "Unmute" : "Mute"} onClick={onToggleMute} size="sm">
        {level === 0 ? <VolumeX size={17} /> : level < 0.5 ? <Volume1 size={17} /> : <Volume2 size={17} />}
      </IconButton>
      <input
        type="range"
        className="range w-24"
        min={0}
        max={1}
        step={0.01}
        value={level}
        onChange={(e) => onSetVolume(Number(e.target.value))}
        aria-label="Volume"
        style={{ "--progress": `${level * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}

interface PlayerBarProps extends TransportProps {
  volume: number;
  isMuted: boolean;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onToggleFavorite: (id: string) => void;
  onOpenNowPlaying: (panel?: "lyrics" | "queue") => void;
  onOpenEqualizer: () => void;
}

export function PlayerBar(props: PlayerBarProps) {
  const { currentTrack, isPlaying, currentTime, duration, onPlayPause, onNext, onOpenNowPlaying, onToggleFavorite } = props;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <>
      {/* Desktop */}
      <footer
        className="hidden h-[84px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-4 border-t border-line bg-surface px-4 md:grid"
        aria-label="Player"
      >
        <div className="flex min-w-0 items-center gap-3">
          {currentTrack ? (
            <>
              <button onClick={() => onOpenNowPlaying()} aria-label="Open now playing" className="group relative shrink-0">
                <Artwork src={currentTrack.coverArtUrl} seed={currentTrack.album} className="size-14 shadow-md shadow-black/40" />
                <span className="absolute inset-0 grid place-items-center rounded-md bg-black/50 opacity-0 transition group-hover:opacity-100">
                  <Maximize2 size={18} />
                </span>
              </button>
              <div className="min-w-0">
                <button onClick={() => onOpenNowPlaying()} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
                  {currentTrack.title}
                </button>
                <p className="truncate text-xs text-muted">{currentTrack.artist}</p>
              </div>
              <IconButton
                label={currentTrack.isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => onToggleFavorite(currentTrack.id)}
                className={currentTrack.isFavorite ? "text-accent hover:text-accent" : ""}
                size="sm"
              >
                <Heart size={16} fill={currentTrack.isFavorite ? "currentColor" : "none"} />
              </IconButton>
            </>
          ) : (
            <p className="text-sm text-faint">Nothing playing</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <Transport {...props} />
          <div className="w-full max-w-xl">
            <Scrubber currentTime={currentTime} duration={duration} onSeek={props.onSeek} disabled={!currentTrack} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-0.5">
          <IconButton label="Lyrics" onClick={() => onOpenNowPlaying("lyrics")} disabled={!currentTrack} size="sm">
            <MicVocal size={17} />
          </IconButton>
          <IconButton label="Queue" onClick={() => onOpenNowPlaying("queue")} size="sm">
            <ListMusic size={17} />
          </IconButton>
          <IconButton label="Equalizer" onClick={props.onOpenEqualizer} size="sm">
            <SlidersHorizontal size={16} />
          </IconButton>
          <VolumeControl volume={props.volume} isMuted={props.isMuted} onSetVolume={props.onSetVolume} onToggleMute={props.onToggleMute} className="ml-1" />
        </div>
      </footer>

      {/* Phone mini player */}
      {currentTrack && (
        <div className="px-2 pb-1.5 md:hidden">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onOpenNowPlaying()}
            onKeyDown={(e) => e.key === "Enter" && onOpenNowPlaying()}
            aria-label="Open now playing"
            className="relative flex h-14 items-center gap-3 overflow-hidden rounded-xl pr-1 pl-2 shadow-xl shadow-black/50"
            style={{ background: "color-mix(in oklab, var(--accent) 22%, #1b1b21)" }}
          >
            <Artwork src={currentTrack.coverArtUrl} seed={currentTrack.album} className="size-10" iconSize={15} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{currentTrack.title}</p>
              <p className="mt-0.5 truncate text-xs leading-tight text-fg/65">{currentTrack.artist}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause();
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="grid size-11 place-items-center"
            >
              {isPlaying ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              aria-label="Next"
              className="grid size-11 place-items-center"
            >
              <SkipForward size={20} fill="currentColor" />
            </button>
            <span className="absolute right-2 bottom-0 left-2 h-0.5 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full bg-fg" style={{ width: `${progress}%` }} />
            </span>
          </div>
        </div>
      )}
    </>
  );
}
