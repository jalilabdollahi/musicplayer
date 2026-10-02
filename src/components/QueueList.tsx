import React from "react";
import { Shuffle, X } from "lucide-react";
import { Track } from "../types/music";
import { Artwork, PlayingBars, formatTime } from "./ui";

interface QueueListProps {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  onPlayIndex: (index: number) => void;
  onRemoveIndex: (index: number) => void;
  onClearUpcoming: () => void;
  onShuffleUpcoming: () => void;
}

export function QueueList({ queue, currentIndex, isPlaying, onPlayIndex, onRemoveIndex, onClearUpcoming, onShuffleUpcoming }: QueueListProps) {
  const current = queue[currentIndex];
  const upcoming = queue.slice(currentIndex + 1);

  const row = (track: Track, index: number, playing: boolean) => (
    <div key={`${track.id}-${index}`} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.06]">
      <button onClick={() => onPlayIndex(index)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Artwork src={track.coverArtUrl} seed={track.album} className="size-10" iconSize={15} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${playing ? "text-accent" : ""}`}>{track.title}</span>
          <span className="block truncate text-xs text-muted">{track.artist}</span>
        </span>
      </button>
      {playing ? (
        <span className="px-2">
          <PlayingBars paused={!isPlaying} />
        </span>
      ) : (
        <>
          <span className="text-xs tabular-nums text-faint group-hover:hidden">{formatTime(track.duration)}</span>
          <button
            onClick={() => onRemoveIndex(index)}
            aria-label={`Remove ${track.title} from queue`}
            className="hidden size-7 place-items-center rounded-full text-muted hover:text-fg group-hover:grid focus-visible:grid"
          >
            <X size={15} />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {current && (
          <>
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Now playing</p>
            {row(current, currentIndex, true)}
          </>
        )}
        <div className="flex items-center justify-between px-2 pt-6 pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            Next up{upcoming.length > 0 && ` · ${upcoming.length}`}
          </p>
          {upcoming.length > 1 && (
            <div className="flex gap-3">
              <button onClick={onShuffleUpcoming} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
                <Shuffle size={13} /> Shuffle
              </button>
              <button onClick={onClearUpcoming} className="text-xs font-medium text-muted hover:text-fg">
                Clear
              </button>
            </div>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">Nothing queued. Use “Play next” or “Add to queue” from any song's menu.</p>
        ) : (
          upcoming.map((t, i) => row(t, currentIndex + 1 + i, false))
        )}
      </div>
    </div>
  );
}
