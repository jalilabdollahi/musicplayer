import React from "react";
import { X, Shuffle, ListMusic, Trash2 } from "lucide-react";
import { Track } from "../types/music";
import { Dialog } from "./Dialog";

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
  const track = queue[currentIndex];
  const upcoming = queue.slice(currentIndex + 1);
  return (
    <Dialog label="Playback queue" onClose={onClose} className="queue-dialog">
      <section className="queue-panel">
        <header className="queue-heading">
          <div>
            <h2>Up next</h2>
            <small>Keep the good music going.</small>
          </div>
          <div>
            <button
              className="icon-button"
              onClick={onShuffleQueue}
              aria-label="Shuffle queue"
            >
              <Shuffle size={18} />
            </button>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close queue"
            >
              <X size={21} />
            </button>
          </div>
        </header>
        <div className="queue-content">
          {track && (
            <>
              <p className="eyebrow">Now playing</p>
              <div className="queue-track current">
                <img src={track.coverArtUrl} alt="" />
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
                <ListMusic size={18} />
              </div>
            </>
          )}
          <p className="eyebrow mt-7">Next in line · {upcoming.length}</p>
          {upcoming.length ? (
            upcoming.map((item, index) => (
              <button
                className="queue-track"
                key={`${item.id}-${index}`}
                onClick={() => onPlayTrackAtIndex(currentIndex + 1 + index)}
              >
                <img src={item.coverArtUrl} alt="" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.artist}</small>
                </span>
                <small>
                  {Math.floor(item.duration / 60)}:
                  {String(Math.floor(item.duration % 60)).padStart(2, "0")}
                </small>
              </button>
            ))
          ) : (
            <p className="queue-empty">
              You’re all caught up. Choose another track from your library.
            </p>
          )}
        </div>
        <footer className="queue-footer">
          <button
            className="secondary-button"
            onClick={onClearQueue}
            disabled={!upcoming.length}
          >
            <Trash2 size={16} /> Clear upcoming tracks
          </button>
        </footer>
      </section>
    </Dialog>
  );
};
