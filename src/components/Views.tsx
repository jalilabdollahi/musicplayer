import React from "react";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  Folder,
  FolderPlus,
  FolderSync,
  Heart,
  HardDrive,
  Link2,
  ListMusic,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { LinkedFolder, Playlist, Track } from "../types/music";
import { Artwork, Button, IconButton, cx, formatBytes, formatTotal } from "./ui";

// ---------------------------------------------------------------- Grouping

export interface Album {
  key: string;
  title: string;
  artist: string;
  year?: number;
  cover?: string;
  tracks: Track[];
}

export interface Artist {
  name: string;
  cover?: string;
  albums: number;
  tracks: Track[];
}

export function albumKey(track: Track): string {
  // Compilations stay together under their album name; untagged files are
  // split per artist so "Unknown Album" does not swallow the whole library.
  return track.album === "Unknown Album" ? `${track.album}\u0000${track.artist}` : track.album.toLowerCase();
}

export function groupAlbums(tracks: Track[]): Album[] {
  const map = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = albumKey(t);
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort(
        (a, b) => (a.trackNo ?? 999) - (b.trackNo ?? 999) || a.title.localeCompare(b.title),
      );
      const artists = new Set(list.map((t) => t.artist));
      return {
        key,
        title: list[0].album,
        artist: artists.size > 2 ? "Various Artists" : [...artists].join(", "),
        year: list.find((t) => t.year)?.year,
        cover: list.find((t) => t.coverArtUrl)?.coverArtUrl,
        tracks: sorted,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function groupArtists(tracks: Track[]): Artist[] {
  const map = new Map<string, Track[]>();
  for (const t of tracks) {
    const list = map.get(t.artist);
    if (list) list.push(t);
    else map.set(t.artist, [t]);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      cover: list.find((t) => t.coverArtUrl)?.coverArtUrl,
      albums: new Set(list.map((t) => t.album)).size,
      tracks: list,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- Folders

/** Pseudo source id for everything imported into the app. */
export const IMPORTED_SOURCE = "imported";

/** A track's path inside its source: relative to the linked folder, or as imported. */
export function trackPath(t: Track): string {
  return (t.source === "folder" ? t.relPath : t.filePath) || t.filePath || t.title;
}

export function tracksInSource(tracks: Track[], source: string): Track[] {
  return source === IMPORTED_SOURCE ? tracks.filter((t) => t.source !== "folder") : tracks.filter((t) => t.folderId === source);
}

export interface FolderNode {
  key: string;
  name: string;
  path: string;
  /** Every track at or below this folder. */
  tracks: Track[];
  cover?: string;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * One level of a source's folder tree: the subfolders directly under `path`
 * and the songs sitting in it, plus everything below it for Play/Shuffle.
 */
export function folderContents(sourceTracks: Track[], path: string) {
  const prefix = path ? `${path}/` : "";
  const all = sourceTracks.filter((t) => trackPath(t).startsWith(prefix));
  const sub = new Map<string, Track[]>();
  const files: Track[] = [];
  for (const t of all) {
    const rest = trackPath(t).slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash < 0) files.push(t);
    else {
      const name = rest.slice(0, slash);
      const list = sub.get(name);
      if (list) list.push(t);
      else sub.set(name, [t]);
    }
  }
  const subfolders: FolderNode[] = [...sub.entries()]
    .map(([name, list]) => ({
      key: `${prefix}${name}`,
      name,
      path: `${prefix}${name}`,
      tracks: list,
      cover: list.find((t) => t.coverArtUrl)?.coverArtUrl,
    }))
    .sort((a, b) => byName(a.name, b.name));
  files.sort((a, b) => byName(trackPath(a), trackPath(b)));
  return { all: [...all].sort((a, b) => byName(trackPath(a), trackPath(b))), subfolders, files };
}

export function FolderGrid({
  folders,
  onOpen,
  onPlay,
  badge,
}: {
  folders: FolderNode[];
  onOpen: (f: FolderNode) => void;
  onPlay: (f: FolderNode) => void;
  /** Optional per-folder status, e.g. a linked folder that needs permission. */
  badge?: (f: FolderNode) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-2 pb-8 sm:grid-cols-3 md:px-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {folders.map((folder) => (
        <div key={folder.key} className="group min-w-0">
          <div className="relative">
            <button onClick={() => onOpen(folder)} className="block w-full" aria-label={`Open folder ${folder.name}`}>
              <Artwork
                src={folder.cover}
                seed={folder.name}
                className="aspect-square w-full shadow-lg shadow-black/40 transition group-hover:brightness-90"
                rounded="rounded-xl"
                iconSize={40}
              />
              <span className="absolute top-2.5 left-2.5 grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur-sm">
                <Folder size={16} />
              </span>
            </button>
            <button
              onClick={() => onPlay(folder)}
              aria-label={`Play folder ${folder.name}`}
              className="absolute right-2.5 bottom-2.5 grid size-11 translate-y-1 place-items-center rounded-full bg-accent text-accent-fg opacity-0 shadow-xl shadow-black/50 transition group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 hover:scale-105"
            >
              <Play size={18} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
          <button onClick={() => onOpen(folder)} className="mt-2.5 block w-full min-w-0 text-left">
            <p className="truncate text-sm font-medium">{folder.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
              {folder.tracks.length} {folder.tracks.length === 1 ? "song" : "songs"}
              {badge?.(folder)}
            </p>
          </button>
        </div>
      ))}
    </div>
  );
}

/** "Music / Pop / Adele", each part clickable except the current folder. */
export function Breadcrumbs({ parts, onOpen }: { parts: { label: string; path: string | null }[]; onOpen: (path: string | null) => void }) {
  return (
    <nav aria-label="Folder path" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted">
      {parts.map((part, i) => {
        const last = i === parts.length - 1;
        return (
          <React.Fragment key={`${part.path}-${i}`}>
            {i > 0 && <ChevronRight size={14} className="text-faint" />}
            {last ? (
              <span className="max-w-[16rem] truncate text-fg" aria-current="page">
                {part.label}
              </span>
            ) : (
              <button onClick={() => onOpen(part.path)} className="max-w-[12rem] truncate rounded hover:text-fg hover:underline">
                {part.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- Page chrome

export function PageHeader({
  title,
  eyebrow,
  meta,
  art,
  onBack,
  actions,
}: {
  title: string;
  eyebrow?: string;
  meta?: React.ReactNode;
  art?: React.ReactNode;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <header className="px-4 pt-4 md:px-8 md:pt-8">
      {onBack && (
        <button
          onClick={onBack}
          className="-ml-2 mb-3 inline-flex h-8 items-center gap-1 rounded-full pr-3 pl-1.5 text-sm text-muted hover:bg-white/[0.06] hover:text-fg"
        >
          <ChevronLeft size={18} /> Back
        </button>
      )}
      <div className={cx("flex gap-5 md:gap-7", art ? "flex-col items-center text-center sm:flex-row sm:items-end sm:text-left" : "items-end")}>
        {art}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</p>}
          <h1
            className={cx(
              "font-bold tracking-tight text-balance",
              art ? "text-3xl md:text-5xl" : "text-3xl md:text-4xl",
            )}
          >
            {title}
          </h1>
          {meta && <p className="mt-2 text-sm text-muted">{meta}</p>}
        </div>
      </div>
      {actions && <div className={cx("mt-6 flex items-center gap-3", !!art && "justify-center sm:justify-start")}>{actions}</div>}
    </header>
  );
}

export function PlayActions({
  disabled,
  onPlay,
  onShuffle,
  extra,
}: {
  disabled?: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <>
      <button
        onClick={onPlay}
        disabled={disabled}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-accent pr-6 pl-5 text-[15px] font-semibold text-accent-fg shadow-lg shadow-black/30 transition hover:scale-[1.03] hover:brightness-110 active:scale-100 disabled:opacity-40"
      >
        <Play size={18} fill="currentColor" /> Play
      </button>
      <button
        onClick={onShuffle}
        disabled={disabled}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.08] px-5 text-[15px] font-semibold transition hover:bg-white/[0.13] disabled:opacity-40"
      >
        <Shuffle size={17} /> Shuffle
      </button>
      {extra}
    </>
  );
}

export type SortKey = "title" | "artist" | "album" | "dateAdded" | "playCount";

export const SORT_LABELS: Record<SortKey, string> = {
  title: "Title",
  artist: "Artist",
  album: "Album",
  dateAdded: "Recently added",
  playCount: "Most played",
};

export function Toolbar({
  query,
  onQuery,
  placeholder,
  sort,
  onSort,
  searchRef,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  sort?: SortKey;
  onSort?: (s: SortKey) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-6 pb-2 md:px-8">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white/[0.06] px-4 transition focus-within:bg-white/[0.09] focus-within:ring-1 focus-within:ring-line-strong md:max-w-sm">
        <Search size={16} className="shrink-0 text-faint" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {query && (
          <button onClick={() => onQuery("")} aria-label="Clear search" className="text-faint hover:text-fg">
            <X size={16} />
          </button>
        )}
      </label>
      {sort && onSort && (
        <label className="relative flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/[0.06] pr-4 pl-3.5 text-sm text-muted hover:text-fg">
          <ArrowDownUp size={15} />
          <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            aria-label="Sort by"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/[0.05] text-muted">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Grids

export function AlbumGrid({ albums, onOpen, onPlay }: { albums: Album[]; onOpen: (a: Album) => void; onPlay: (a: Album) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-2 pb-8 sm:grid-cols-3 md:px-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {albums.map((album) => (
        <div key={album.key} className="group min-w-0">
          <div className="relative">
            <button onClick={() => onOpen(album)} className="block w-full" aria-label={`Open ${album.title}`}>
              <Artwork
                src={album.cover}
                seed={album.title}
                className="aspect-square w-full shadow-lg shadow-black/40 transition group-hover:brightness-90"
                rounded="rounded-xl"
                iconSize={40}
              />
            </button>
            <button
              onClick={() => onPlay(album)}
              aria-label={`Play ${album.title}`}
              className="absolute right-2.5 bottom-2.5 grid size-11 translate-y-1 place-items-center rounded-full bg-accent text-accent-fg opacity-0 shadow-xl shadow-black/50 transition group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 hover:scale-105"
            >
              <Play size={18} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
          <button onClick={() => onOpen(album)} className="mt-2.5 block w-full min-w-0 text-left">
            <p className="truncate text-sm font-medium">{album.title}</p>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {album.artist}
              {album.year ? ` · ${album.year}` : ""}
            </p>
          </button>
        </div>
      ))}
    </div>
  );
}

export function ArtistGrid({ artists, onOpen }: { artists: Artist[]; onOpen: (a: Artist) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-2 pb-8 sm:grid-cols-3 md:px-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {artists.map((artist) => (
        <button key={artist.name} onClick={() => onOpen(artist)} className="group min-w-0 text-center">
          <Artwork
            src={artist.cover}
            seed={artist.name}
            className="mx-auto aspect-square w-full max-w-48 shadow-lg shadow-black/40 transition group-hover:brightness-90"
            rounded="rounded-full"
            iconSize={36}
          />
          <p className="mt-3 truncate text-sm font-medium">{artist.name}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {artist.tracks.length} {artist.tracks.length === 1 ? "song" : "songs"}
          </p>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Playlists (phone tab)

export function PlaylistsIndex({
  playlists,
  favoritesCount,
  recentCount,
  onOpenFavorites,
  onOpenRecent,
  onOpenFolders,
  onOpenPlaylist,
  onCreate,
  onOpenSources,
  needsReconnect,
}: {
  playlists: Playlist[];
  favoritesCount: number;
  recentCount: number;
  onOpenFavorites: () => void;
  onOpenRecent: () => void;
  onOpenFolders: () => void;
  onOpenPlaylist: (id: string) => void;
  onCreate: () => void;
  onOpenSources: () => void;
  needsReconnect: boolean;
}) {
  const Row = ({ icon, title, sub, onClick, tint }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; tint?: string }) => (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]">
      <span className={cx("grid size-14 shrink-0 place-items-center rounded-lg", tint ?? "bg-white/[0.06] text-muted")}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-sm text-muted">{sub}</span>
      </span>
    </button>
  );
  return (
    <div className="px-2 pb-8 md:px-6">
      <div className="mt-2 flex flex-col gap-1">
        <Row icon={<Heart size={22} fill="currentColor" />} tint="bg-accent/20 text-accent" title="Favorites" sub={`${favoritesCount} songs`} onClick={onOpenFavorites} />
        <Row icon={<Sparkles size={22} />} title="Recently added" sub={`${recentCount} songs`} onClick={onOpenRecent} />
        <Row icon={<Folder size={22} />} title="Folders" sub="Browse songs folder by folder" onClick={onOpenFolders} />
        {playlists.map((pl) => (
          <Row
            key={pl.id}
            icon={pl.isSmart ? <Sparkles size={22} /> : <ListMusic size={22} />}
            title={pl.name}
            sub={pl.isSmart ? "Smart playlist" : "Playlist"}
            onClick={() => onOpenPlaylist(pl.id)}
          />
        ))}
        <Row icon={<Plus size={22} />} title="New smart playlist" sub="Fills itself from rules you choose" onClick={onCreate} />
        <Row
          icon={needsReconnect ? <TriangleAlert size={22} /> : <FolderSync size={22} />}
          tint={needsReconnect ? "bg-amber-400/15 text-amber-300" : undefined}
          title="Music sources"
          sub={needsReconnect ? "A folder needs to be reconnected" : "Folders and imported files"}
          onClick={onOpenSources}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- First run

export function Welcome({
  canLinkFolder,
  onLinkFolder,
  onImportFolder,
  onImportFiles,
}: {
  canLinkFolder: boolean;
  onLinkFolder: () => void;
  onImportFolder: () => void;
  onImportFiles: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-10 pb-16 text-center md:pt-20">
      <div className="relative mb-8">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-accent/25 blur-3xl" />
        <div className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-accent to-accent/40 text-accent-fg shadow-2xl shadow-black/50">
          <FileAudio size={36} strokeWidth={1.75} />
        </div>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">Bring your music</h1>
      <p className="mt-3 max-w-md text-[15px] text-muted text-balance">
        HighFi plays the files you already have. Everything stays on this device — nothing is uploaded anywhere.
      </p>

      <div className={cx("mt-10 grid w-full gap-3 text-left", canLinkFolder ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {canLinkFolder && (
          <SourceCard
            primary
            icon={<Link2 size={20} />}
            title="Link a folder"
            body="Plays straight from disk. New files show up automatically. Nothing is copied."
            onClick={onLinkFolder}
          />
        )}
        <SourceCard
          primary={!canLinkFolder}
          icon={<FolderPlus size={20} />}
          title="Import a folder"
          body="Copies every song in a folder, subfolders included, into the app."
          onClick={onImportFolder}
        />
        <SourceCard icon={<FileAudio size={20} />} title="Import files" body="Pick individual songs and .lrc lyrics files." onClick={onImportFiles} />
      </div>
      <p className="mt-6 text-[13px] text-faint">You can also drag files or folders anywhere onto this window.</p>
    </div>
  );
}

function SourceCard({ icon, title, body, onClick, primary }: { icon: React.ReactNode; title: string; body: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "group flex flex-col items-start rounded-2xl border p-5 text-left transition hover:-translate-y-0.5",
        primary ? "border-accent/40 bg-accent/[0.08] hover:bg-accent/[0.12]" : "border-line bg-white/[0.03] hover:bg-white/[0.06]",
      )}
    >
      <span className={cx("grid size-10 place-items-center rounded-xl", primary ? "bg-accent text-accent-fg" : "bg-white/[0.08] text-fg")}>{icon}</span>
      <span className="mt-4 font-semibold">{title}</span>
      <span className="mt-1 text-[13px] leading-relaxed text-muted">{body}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Sources

export interface FolderStatus {
  folder: LinkedFolder;
  granted: boolean;
  trackCount: number;
}

export function SourcesView({
  folders,
  importedCount,
  storage,
  canLinkFolder,
  scanning,
  onLinkFolder,
  onImportFolder,
  onImportFiles,
  onReconnect,
  onRescan,
  onUnlink,
  onClearImported,
}: {
  folders: FolderStatus[];
  importedCount: number;
  storage: { usage: number; quota: number } | null;
  canLinkFolder: boolean;
  scanning: boolean;
  onLinkFolder: () => void;
  onImportFolder: () => void;
  onImportFiles: () => void;
  onReconnect: (f: LinkedFolder) => void;
  onRescan: (f: LinkedFolder) => void;
  onUnlink: (f: LinkedFolder) => void;
  onClearImported: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 md:px-8">
      <div className="-mx-4 md:-mx-8">
        <PageHeader title="Music sources" meta="Where your library comes from. Everything stays on this device." />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Linked folders</h2>
          {canLinkFolder && (
            <Button onClick={onLinkFolder} className="h-9 px-4">
              <Link2 size={16} /> Link folder
            </Button>
          )}
        </div>
        {!canLinkFolder ? (
          <p className="mt-3 rounded-xl border border-line bg-white/[0.03] p-4 text-sm text-muted">
            This browser can't link folders. Chrome and Edge on desktop can, and they read your music in place without copying it.
            Here, music is imported into the app instead.
          </p>
        ) : folders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
            No folders linked yet. A linked folder is read straight from disk and rescanned each time you open HighFi.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white/[0.03]">
            {folders.map(({ folder, granted, trackCount }) => (
              <li key={folder.id} className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className={cx(
                    "grid size-10 shrink-0 place-items-center rounded-lg",
                    granted ? "bg-accent/15 text-accent" : "bg-amber-400/15 text-amber-300",
                  )}
                >
                  {granted ? <FolderSync size={19} /> : <TriangleAlert size={19} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{folder.name}</p>
                  <p className="text-[13px] text-muted">
                    {trackCount} songs
                    {granted
                      ? folder.lastScanAt
                        ? ` · scanned ${new Date(folder.lastScanAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                        : ""
                      : " · access needs to be granted again"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {granted ? (
                    <IconButton label="Rescan folder" onClick={() => onRescan(folder)} disabled={scanning}>
                      <RefreshCw size={17} className={scanning ? "animate-spin" : ""} />
                    </IconButton>
                  ) : (
                    <Button variant="primary" className="h-8 px-4 text-[13px]" onClick={() => onReconnect(folder)}>
                      Reconnect
                    </Button>
                  )}
                  <IconButton label="Unlink folder" onClick={() => onUnlink(folder)}>
                    <Trash2 size={17} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">Imported into the app</h2>
        <div className="mt-3 rounded-xl border border-line bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-muted">
              <HardDrive size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{importedCount} songs</p>
              <p className="text-[13px] text-muted">
                {storage ? `${formatBytes(storage.usage)} used of ${formatBytes(storage.quota)} available to this app` : "Stored in this browser"}
              </p>
            </div>
          </div>
          {storage && storage.quota > 0 && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(1, Math.min(100, (storage.usage / storage.quota) * 100))}%` }} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onImportFolder} className="h-9 px-4">
              <FolderPlus size={16} /> Import folder
            </Button>
            <Button onClick={onImportFiles} className="h-9 px-4">
              <FileAudio size={16} /> Import files
            </Button>
            {importedCount > 0 && (
              <Button variant="ghost" onClick={onClearImported} className="h-9 px-4 text-danger hover:text-danger">
                <Trash2 size={16} /> Remove all imported
              </Button>
            )}
          </div>
        </div>
      </section>

      <p className="mt-8 text-[13px] leading-relaxed text-faint">
        Removing music from HighFi never deletes files on your disk. Imported copies live in this browser's storage and are
        removed if you clear site data.
      </p>
    </div>
  );
}

export function totalDuration(tracks: Track[]): string {
  return formatTotal(tracks.reduce((s, t) => s + (t.duration || 0), 0));
}
