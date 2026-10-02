import React, { useState } from "react";
import {
  Disc3,
  Heart,
  Info,
  ListEnd,
  ListStart,
  MoreHorizontal,
  Play,
  Trash2,
  User,
} from "lucide-react";
import { Track } from "../types/music";
import { Artwork, Menu, MenuItem, PlayingBars, cx, formatTime, qualityLabel } from "./ui";

export interface TrackActions {
  onPlay: (track: Track, list: Track[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onShowInfo: (track: Track) => void;
  onRemove: (track: Track) => void;
  onGoToAlbum: (track: Track) => void;
  onGoToArtist: (track: Track) => void;
}

interface TrackListProps extends TrackActions {
  tracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  /** Album pages number by track number and drop the art and album columns. */
  variant?: "library" | "album";
}

export function TrackList({ tracks, currentTrackId, isPlaying, variant = "library", ...actions }: TrackListProps) {
  const [menu, setMenu] = useState<{ track: Track; anchor: DOMRect } | null>(null);
  const album = variant === "album";

  const menuItems = (track: Track): MenuItem[] => [
    { label: "Play next", icon: <ListStart />, onSelect: () => actions.onPlayNext(track) },
    { label: "Add to queue", icon: <ListEnd />, onSelect: () => actions.onAddToQueue(track) },
    { label: track.isFavorite ? "Remove from favorites" : "Add to favorites", icon: <Heart />, onSelect: () => actions.onToggleFavorite(track.id) },
    ...(album ? [] : [{ label: "Go to album", icon: <Disc3 />, onSelect: () => actions.onGoToAlbum(track) }]),
    { label: "Go to artist", icon: <User />, onSelect: () => actions.onGoToArtist(track) },
    { label: "Track info", icon: <Info />, onSelect: () => actions.onShowInfo(track) },
    { label: "Remove from library", icon: <Trash2 />, danger: true, onSelect: () => actions.onRemove(track) },
  ];

  const columns = album
    ? "md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_4.5rem_4.5rem]"
    : "md:grid-cols-[2.5rem_minmax(0,5fr)_minmax(0,3fr)_7rem_4.5rem_4.5rem]";

  return (
    <div role="table" aria-label="Tracks" className="pb-4">
      <div
        role="row"
        className={cx(
          "sticky top-0 z-10 hidden h-9 items-center gap-4 border-b border-line bg-bg/90 px-3 text-xs font-medium text-faint backdrop-blur md:grid",
          columns,
        )}
      >
        <span role="columnheader" className="text-right">#</span>
        <span role="columnheader">Title</span>
        {!album && <span role="columnheader">Album</span>}
        <span role="columnheader">Quality</span>
        <span role="columnheader" className="text-right">Time</span>
        <span role="columnheader" aria-label="Actions" />
      </div>

      <div className="mt-1 md:mt-2">
        {tracks.map((track, index) => {
          const current = track.id === currentTrackId;
          return (
            <div
              key={track.id}
              role="row"
              onClick={() => actions.onPlay(track, tracks)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ track, anchor: new DOMRect(e.clientX, e.clientY, 0, 0) });
              }}
              className={cx(
                "track-row group grid h-14 cursor-default grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 md:gap-4 md:px-3",
                columns,
                current ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
              )}
            >
              {/* Index / play affordance (desktop) and cover (mobile + library) */}
              <div role="cell" className="flex items-center gap-3 md:contents">
                <span className="hidden w-10 justify-end text-sm tabular-nums text-faint md:flex">
                  {current ? (
                    <PlayingBars paused={!isPlaying} />
                  ) : (
                    <>
                      <span className="group-hover:hidden">{album ? track.trackNo || index + 1 : index + 1}</span>
                      <Play size={15} fill="currentColor" className="hidden text-fg group-hover:block" />
                    </>
                  )}
                </span>
                {album ? (
                  <span className="w-6 text-center text-sm tabular-nums text-faint md:hidden">
                    {current ? <PlayingBars paused={!isPlaying} /> : track.trackNo || index + 1}
                  </span>
                ) : (
                  <Artwork src={track.coverArtUrl} seed={track.album} className="size-11 md:hidden" iconSize={16} />
                )}
              </div>

              <div role="cell" className="flex min-w-0 items-center gap-3">
                {!album && <Artwork src={track.coverArtUrl} seed={track.album} className="hidden size-10 md:block" iconSize={15} />}
                <div className="min-w-0">
                  <p className={cx("truncate text-[15px] font-medium leading-tight md:text-sm", current ? "text-accent" : "text-fg")}>
                    {track.title}
                  </p>
                  <p className="mt-1 truncate text-[13px] leading-tight text-muted">
                    {track.isFavorite && <Heart size={11} fill="currentColor" className="mr-1 -mt-0.5 inline text-accent md:hidden" />}
                    {track.artist}
                  </p>
                </div>
              </div>

              {!album && (
                <button
                  role="cell"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.onGoToAlbum(track);
                  }}
                  className="hidden min-w-0 truncate text-left text-sm text-muted hover:text-fg hover:underline md:block"
                >
                  {track.album}
                </button>
              )}

              <span role="cell" className="hidden md:block">
                <span
                  className={cx(
                    "inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide",
                    track.isHiRes ? "bg-accent/15 text-accent" : "bg-white/[0.06] text-muted",
                  )}
                >
                  {qualityLabel(track)}
                </span>
              </span>

              <span role="cell" className="hidden text-right text-sm tabular-nums text-muted md:block">
                {track.duration > 0 ? formatTime(track.duration) : "—"}
              </span>

              <div role="cell" className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => actions.onToggleFavorite(track.id)}
                  aria-label={track.isFavorite ? `Remove ${track.title} from favorites` : `Add ${track.title} to favorites`}
                  aria-pressed={!!track.isFavorite}
                  className={cx(
                    "hidden size-8 place-items-center rounded-full transition md:grid",
                    track.isFavorite ? "text-accent" : "text-muted opacity-0 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <Heart size={16} fill={track.isFavorite ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => setMenu({ track, anchor: e.currentTarget.getBoundingClientRect() })}
                  aria-label={`More options for ${track.title}`}
                  aria-haspopup="menu"
                  className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-white/[0.06] hover:text-fg md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {menu && <Menu anchor={menu.anchor} items={menuItems(menu.track)} onClose={() => setMenu(null)} />}
    </div>
  );
}
