import React, { useEffect, useMemo, useState } from "react";
import { Heart, LoaderCircle, Radio, Search, X } from "lucide-react";
import { LiveStatus } from "../services/audioEngine";
import { GERMAN_STATIONS, RADIO_CATEGORIES, RadioCategory, RadioStation, searchGermanStations } from "../services/radio";
import { Track } from "../types/music";
import { Artwork, IconButton, PlayingBars, cx } from "./ui";
import { EmptyState, PageHeader } from "./Views";

type Filter = "all" | "favorites" | RadioCategory;

const SEARCH_DEBOUNCE_MS = 350;

interface RadioViewProps {
  favorites: RadioStation[];
  currentTrack: Track | null;
  isPlaying: boolean;
  liveStatus: LiveStatus;
  /** Plays one station; the rest of the list becomes the next/previous order. */
  onPlay: (stations: RadioStation[], index: number) => void;
  onPlayPause: () => void;
  onToggleFavorite: (station: RadioStation) => void;
}

export function RadioView({ favorites, currentTrack, isPlaying, liveStatus, onPlay, onPlayPause, onToggleFavorite }: RadioViewProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RadioStation[]>([]);
  const [search, setSearch] = useState<"idle" | "loading" | "failed">("idle");

  const trimmed = query.trim();

  useEffect(() => {
    setResults([]);
    if (!trimmed) {
      setSearch("idle");
      return;
    }
    setSearch("loading");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchGermanStations(trimmed, controller.signal)
        .then((found) => {
          setResults(found);
          setSearch("idle");
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearch("failed");
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const favoriteIds = useMemo(() => new Set(favorites.map((s) => s.id)), [favorites]);

  const stations = useMemo(() => {
    if (trimmed) {
      // Hand-picked stations first, since their streams are known to be good.
      const needle = trimmed.toLowerCase();
      const curated = GERMAN_STATIONS.filter((s) => `${s.name} ${s.subtitle}`.toLowerCase().includes(needle));
      const seen = new Set(curated.flatMap((s) => [s.name.toLowerCase(), s.url]));
      return [...curated, ...results.filter((s) => !seen.has(s.name.toLowerCase()) && !seen.has(s.url))];
    }
    if (filter === "favorites") return favorites;
    if (filter === "all") return GERMAN_STATIONS;
    return GERMAN_STATIONS.filter((s) => s.category === filter);
  }, [trimmed, results, filter, favorites]);

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Favorites" },
    ...RADIO_CATEGORIES,
  ];

  return (
    <div className="pb-8">
      <PageHeader eyebrow="Live from Germany" title="Radio" meta="Free stations, streamed live from each broadcaster. Needs an internet connection." />

      <div className="mt-6 px-4 md:px-8">
        <label className="relative block max-w-md">
          <span className="sr-only">Search German stations</span>
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by station or genre"
            className="h-10 w-full rounded-full border border-line bg-white/[0.05] pr-10 pl-10 text-sm outline-none placeholder:text-faint focus:border-line-strong"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
            >
              <X size={15} />
            </button>
          )}
        </label>

        {!trimmed && (
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {chips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                aria-pressed={filter === chip.id}
                className={cx(
                  "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition",
                  filter === chip.id ? "bg-fg text-bg" : "bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {stations.length > 0 && (
        <ul className="mt-5 grid gap-1 px-2 md:px-6 xl:grid-cols-2">
          {stations.map((station, index) => {
            const isCurrent = currentTrack?.id === station.id;
            return (
              <li key={station.id}>
                <StationRow
                  station={station}
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  isConnecting={isCurrent && isPlaying && liveStatus === "connecting"}
                  isFavorite={favoriteIds.has(station.id)}
                  onSelect={() => (isCurrent ? onPlayPause() : onPlay(stations, index))}
                  onToggleFavorite={() => onToggleFavorite(station)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {trimmed && search === "loading" && (
        <p className="mt-5 flex items-center gap-2 px-4 text-sm text-muted md:px-8" role="status">
          <LoaderCircle size={15} className="animate-spin" /> Searching…
        </p>
      )}
      {trimmed && search === "failed" && (
        <p className="mt-5 px-4 text-sm text-muted md:px-8" role="status">
          The station directory isn't reachable right now, so only hand-picked stations are shown.
        </p>
      )}
      {trimmed && search === "idle" && stations.length === 0 && (
        <EmptyState icon={<Radio size={24} />} title="No stations found" body={`Nothing in Germany matches “${trimmed}”. Try a station name or a genre like jazz.`} />
      )}
      {!trimmed && filter === "favorites" && favorites.length === 0 && (
        <EmptyState icon={<Heart size={24} />} title="No favorite stations yet" body="Tap the heart next to a station to keep it here." />
      )}
    </div>
  );
}

function StationRow({
  station,
  isCurrent,
  isPlaying,
  isConnecting,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  station: RadioStation;
  isCurrent: boolean;
  isPlaying: boolean;
  isConnecting: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const quality = station.bitrate ? `${station.format} ${station.bitrate}` : station.format;
  return (
    <div className={cx("flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-white/[0.05]", isCurrent && "bg-white/[0.06]")}>
      <button onClick={onSelect} aria-label={`${isPlaying ? "Pause" : "Play"} ${station.name}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left">
        <span className="relative shrink-0">
          <Artwork seed={station.name} className="size-11" iconSize={17} />
          {isCurrent && (
            <span className="absolute inset-0 grid place-items-center rounded-md bg-black/55">
              {isConnecting ? <LoaderCircle size={17} className="animate-spin" aria-label="Connecting" /> : <PlayingBars paused={!isPlaying} />}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate text-sm font-medium", isCurrent && "text-accent")}>{station.name}</span>
          <span className="block truncate text-xs text-muted">{station.subtitle}</span>
        </span>
        <span className="hidden shrink-0 text-[11px] font-medium tabular-nums text-faint sm:block">{quality}</span>
      </button>
      <IconButton
        label={isFavorite ? `Remove ${station.name} from favorites` : `Add ${station.name} to favorites`}
        onClick={onToggleFavorite}
        className={isFavorite ? "text-accent hover:text-accent" : ""}
        size="sm"
      >
        <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
      </IconButton>
    </div>
  );
}
