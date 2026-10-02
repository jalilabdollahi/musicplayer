import React, { useState } from 'react';
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
  Volume1,
  FileText,
  Sliders,
  Heart,
  Headphones,
  Maximize2,
  List,
} from 'lucide-react';
import { RepeatMode, Track } from '../types/music';

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
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-20 bg-[#0c0f16]/95 backdrop-blur-2xl border-t border-white/[0.08] flex items-center justify-between px-4 select-none shrink-0 z-30 relative">
      {/* 1. Track Info (Left) */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        {currentTrack ? (
          <>
            <div className="relative group w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-white/10 shadow-md">
              <img
                src={currentTrack.coverArtUrl || ''}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={onOpenInspector}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white font-medium"
                title="Inspect Audio Stream"
              >
                Inspect
              </button>
            </div>

            <div className="flex flex-col truncate min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm font-semibold text-white truncate">
                  {currentTrack.title}
                </span>
                <button
                  onClick={() => onToggleFavorite(currentTrack.id)}
                  aria-label={currentTrack.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className="shrink-0 p-1 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      currentTrack.isFavorite ? 'text-rose-500 fill-rose-500' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                <span className="truncate">{currentTrack.artist}</span>
                <span className="text-slate-600">•</span>
                <button
                  onClick={onOpenInspector}
                  className="text-[10px] font-mono font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                  title="Click to view stream details"
                >
                  {currentTrack.format} {currentTrack.bitDepth}b/
                  {Math.round(currentTrack.sampleRate / 1000)}k
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500">No track selected</div>
        )}
      </div>

      {/* 2. Controls & Scrubber (Center) */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl px-4">
        {/* Playback Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              shuffle ? 'text-sky-400 bg-sky-500/15' : 'text-slate-400 hover:text-white'
            }`}
            title="Shuffle (⌘+S)"
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrev}
            className="p-1.5 rounded-full text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Previous (⌘+←)"
            aria-label="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10 cursor-pointer"
            title="Play / Pause (Space)"
            aria-label="Play / Pause"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-1.5 rounded-full text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Next (⌘+→)"
            aria-label="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onCycleRepeat}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              repeatMode !== 'off'
                ? 'text-sky-400 bg-sky-500/15'
                : 'text-slate-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode} (⌘+R)`}
            aria-label={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrubber Bar */}
        <div className="w-full flex items-center gap-2 text-[11px] font-mono-numbers text-slate-400">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>

          <div className="relative flex-1 group flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-1 bg-white/15 rounded-full appearance-none group-hover:h-1.5 transition-all"
              style={{
                background: `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%, rgba(255,255,255,0.15) 100%)`,
              }}
              title="Seek track"
              aria-label="Seek track position"
            />
          </div>

          <span className="w-10 text-left">
            {duration > 0 ? `-${formatTime(Math.max(0, duration - currentTime))}` : '0:00'}
          </span>
        </div>
      </div>

      {/* 3. Audio Studio & Volume (Right) */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        {/* Synced Lyrics Toggle */}
        <button
          onClick={onToggleLyrics}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            showLyrics
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Synced Lyrics (⌘+L)"
          aria-label="Synced Lyrics"
        >
          <FileText className="w-4 h-4" />
        </button>

        {/* Spatial Audio Toggle */}
        <button
          onClick={onToggleSpatialAudio}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            isSpatialAudioEnabled
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Spatial Audio / Binaural Staging"
          aria-label="Spatial Audio / Binaural Staging"
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* EQ Studio Toggle */}
        <button
          onClick={onOpenEqualizer}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          title="10-Band Graphic EQ & DSP (⌘+E)"
          aria-label="10-Band Graphic EQ & DSP"
        >
          <Sliders className="w-4 h-4 text-amber-400" />
        </button>

        {/* Queue Drawer Toggle */}
        <button
          onClick={onToggleQueue}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            showQueue
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Playback Queue"
          aria-label="Playback Queue"
        >
          <List className="w-4 h-4" />
        </button>

        {/* Volume & Mute */}
        <div className="flex items-center gap-1.5 pl-1">
          <button
            onClick={onToggleMute}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Mute / Unmute (⌘+M)"
            aria-label="Mute / Unmute"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-white/20 rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.15) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.15) 100%)`,
            }}
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            aria-label="Adjust volume"
          />
        </div>
      </div>
    </footer>
  );
};
