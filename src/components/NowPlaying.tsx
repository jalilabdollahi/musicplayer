import React, { useEffect, useState } from "react";
import { ChevronDown, Heart, Info, ListMusic, MicVocal, SlidersHorizontal } from "lucide-react";
import { SyncedLyricLine, Track } from "../types/music";
import { Dialog } from "./Dialog";
import { LyricsPanel } from "./LyricsPanel";
import { QueueList } from "./QueueList";
import { Scrubber, SpeedButton, Transport, TransportProps, VolumeControl } from "./PlayerBar";
import { Artwork, IconButton, cx, qualityLabel } from "./ui";

export type NowPlayingPanel = "lyrics" | "queue";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

interface NowPlayingProps extends TransportProps {
  initialPanel?: NowPlayingPanel;
  queue: Track[];
  currentIndex: number;
  volume: number;
  isMuted: boolean;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onOpenEqualizer: () => void;
  onShowInfo: (t: Track) => void;
  onUpdateLyrics: (trackId: string, lyrics: SyncedLyricLine[], rawLrc: string) => void;
  onPlayIndex: (i: number) => void;
  onRemoveIndex: (i: number) => void;
  onClearUpcoming: () => void;
  onShuffleUpcoming: () => void;
  playbackRate: number;
  onCyclePlaybackRate: () => void;
}

export function NowPlaying(props: NowPlayingProps) {
  const { currentTrack: track, onClose } = props;
  const wide = useMediaQuery("(min-width: 1024px)");
  // On wide screens a side panel is always shown; on phones it replaces the art.
  const [panel, setPanel] = useState<NowPlayingPanel | null>(props.initialPanel ?? null);
  const sidePanel: NowPlayingPanel = panel ?? "lyrics";

  const togglePanel = (p: NowPlayingPanel) => setPanel((cur) => (cur === p && !wide ? null : p));

  const panelBody = (which: NowPlayingPanel) =>
    which === "lyrics" ? (
      <LyricsPanel track={track} currentTime={props.currentTime} onSeek={props.onSeek} onUpdateLyrics={props.onUpdateLyrics} />
    ) : (
      <QueueList
        queue={props.queue}
        currentIndex={props.currentIndex}
        isPlaying={props.isPlaying}
        onPlayIndex={props.onPlayIndex}
        onRemoveIndex={props.onRemoveIndex}
        onClearUpcoming={props.onClearUpcoming}
        onShuffleUpcoming={props.onShuffleUpcoming}
      />
    );

  const titleBlock = track && (
    <div className="flex w-full items-center gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-bold tracking-tight md:text-2xl">{track.title}</h2>
        <p className="truncate text-base text-fg/65 md:text-lg">{track.artist}</p>
      </div>
      <IconButton
        label={track.isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={() => props.onToggleFavorite(track.id)}
        className={track.isFavorite ? "text-accent hover:text-accent" : "text-fg/70"}
        size="lg"
      >
        <Heart size={22} fill={track.isFavorite ? "currentColor" : "none"} />
      </IconButton>
    </div>
  );

  return (
    <Dialog label="Now playing" onClose={onClose} fullscreen>
      <section className="relative isolate flex h-full flex-col overflow-hidden bg-bg animate-slide-up">
        {/* Ambient backdrop from the artwork */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {track?.coverArtUrl ? (
            <img src={track.coverArtUrl} alt="" className="h-full w-full scale-125 object-cover opacity-55 blur-[90px] saturate-150" />
          ) : (
            <div className="h-full w-full opacity-60" style={{ background: "radial-gradient(circle at 30% 20%, var(--accent), transparent 60%)" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/80" />
        </div>

        <header className="pt-safe flex shrink-0 items-center gap-2 px-3 pt-3 md:px-6 md:pt-5">
          <IconButton label="Close" onClick={onClose} size="lg" className="text-fg">
            <ChevronDown size={26} />
          </IconButton>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg/60">Playing from</p>
            <p className="truncate text-sm font-semibold">{track?.album ?? "Your library"}</p>
          </div>
          <IconButton label="Track info" onClick={() => track && props.onShowInfo(track)} disabled={!track} size="lg" className="text-fg/80">
            <Info size={20} />
          </IconButton>
        </header>

        <div className={cx("flex min-h-0 flex-1", wide ? "gap-12 px-12 pt-6 pb-10" : "flex-col px-6 pt-4 pb-6")}>
          {/* Player column */}
          <div className={cx("flex min-h-0 flex-col", wide ? "w-[min(44vh,460px)] shrink-0 justify-center" : "flex-1")}>
            {!wide && panel ? (
              <>
                {track && (
                  <div className="mb-4 flex items-center gap-3">
                    <Artwork src={track.coverArtUrl} seed={track.album} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{track.title}</p>
                      <p className="truncate text-sm text-fg/65">{track.artist}</p>
                    </div>
                  </div>
                )}
                <div className="min-h-0 flex-1">{panelBody(panel)}</div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center py-2">
                <Artwork
                  src={track?.coverArtUrl}
                  seed={track?.album ?? ""}
                  className={cx(
                    "aspect-square shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] transition-transform duration-500",
                    wide ? "w-full" : "max-h-full w-full max-w-[min(100%,420px)]",
                    !props.isPlaying && "scale-[0.94]",
                  )}
                  rounded="rounded-2xl"
                  iconSize={72}
                />
              </div>
            )}

            <div className={cx("flex shrink-0 flex-col items-center", wide ? "mt-8 gap-5" : "mt-5 gap-4")}>
              {!(!wide && panel) && titleBlock}
              <Scrubber currentTime={props.currentTime} duration={props.duration} onSeek={props.onSeek} disabled={!track} large />
              <Transport {...props} large />
              {wide ? (
                <div className="flex w-full items-center justify-between">
                  <VolumeControl volume={props.volume} isMuted={props.isMuted} onSetVolume={props.onSetVolume} onToggleMute={props.onToggleMute} />
                  <div className="flex items-center gap-2">
                    <SpeedButton rate={props.playbackRate} onCycle={props.onCyclePlaybackRate} className={props.playbackRate === 1 ? "text-fg/70" : ""} />
                    {track && (
                      <span className="rounded bg-white/10 px-2 py-1 text-[11px] font-semibold tracking-wide text-fg/70">{qualityLabel(track)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex w-full items-center justify-between px-2">
                  <IconButton label="Lyrics" active={panel === "lyrics"} onClick={() => togglePanel("lyrics")} className={panel === "lyrics" ? "" : "text-fg/70"}>
                    <MicVocal size={20} />
                  </IconButton>
                  <SpeedButton rate={props.playbackRate} onCycle={props.onCyclePlaybackRate} className={cx("h-9", props.playbackRate === 1 && "text-fg/70")} />
                  <IconButton label="Equalizer" onClick={props.onOpenEqualizer} className="text-fg/70">
                    <SlidersHorizontal size={19} />
                  </IconButton>
                  <IconButton label="Queue" active={panel === "queue"} onClick={() => togglePanel("queue")} className={panel === "queue" ? "" : "text-fg/70"}>
                    <ListMusic size={20} />
                  </IconButton>
                </div>
              )}
            </div>
          </div>

          {/* Side panel (wide screens) */}
          {wide && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl bg-black/25 p-6 backdrop-blur-sm">
              <div className="mb-3 flex shrink-0 items-center gap-1" role="tablist">
                {(["lyrics", "queue"] as const).map((p) => (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={sidePanel === p}
                    onClick={() => setPanel(p)}
                    className={cx(
                      "h-9 rounded-full px-4 text-sm font-semibold transition",
                      sidePanel === p ? "bg-fg text-bg" : "text-fg/70 hover:bg-white/10 hover:text-fg",
                    )}
                  >
                    {p === "lyrics" ? "Lyrics" : "Up next"}
                  </button>
                ))}
                <div className="flex-1" />
                <IconButton label="Equalizer" onClick={props.onOpenEqualizer} className="text-fg/70">
                  <SlidersHorizontal size={18} />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1">{panelBody(sidePanel)}</div>
            </div>
          )}
        </div>
      </section>
    </Dialog>
  );
}
