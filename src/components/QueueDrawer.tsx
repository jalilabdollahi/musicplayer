import React from 'react';
import { X, Play, Music, Sparkles, Trash2, Shuffle } from 'lucide-react';
import { Track } from '../types/music';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  currentIndex: number;
  onPlayTrackAtIndex: (index: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  currentIndex,
  onPlayTrackAtIndex,
  onClearQueue,
  onShuffleQueue,
}) => {
  if (!isOpen) return null;

  const currentTrack = queue[currentIndex];
  const upNextTracks = queue.slice(currentIndex + 1);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-80 bg-[#0e111a]/95 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col h-full select-none shrink-0 z-20 shadow-2xl">
      {/* Header */}
      <div className="h-14 px-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Playback Queue</h3>
          <span className="text-[10px] font-mono text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded">
            {queue.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onShuffleQueue}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Shuffle queue"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Now Playing */}
        {currentTrack && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 px-1 mb-2">
              Now Playing
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
              <img
                src={currentTrack.coverArtUrl}
                alt={currentTrack.title}
                className="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0"
              />
              <div className="truncate min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                <div className="text-[11px] text-sky-200 truncate">{currentTrack.artist}</div>
                <div className="text-[9px] font-mono text-amber-300 mt-0.5 font-semibold">
                  {currentTrack.format} {currentTrack.bitDepth}b/
                  {Math.round(currentTrack.sampleRate / 1000)}k
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Up Next */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Up Next ({upNextTracks.length})
            </span>
          </div>

          {upNextTracks.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">No more tracks in queue</div>
          ) : (
            <div className="space-y-1">
              {upNextTracks.map((track, i) => {
                const actualIndex = currentIndex + 1 + i;
                return (
                  <div
                    key={`${track.id}-${actualIndex}`}
                    onClick={() => onPlayTrackAtIndex(actualIndex)}
                    className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <img
                        src={track.coverArtUrl}
                        alt={track.title}
                        className="w-8 h-8 rounded-md object-cover shrink-0"
                      />
                      <div className="truncate min-w-0">
                        <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                          {track.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{track.artist}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 pl-2">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
