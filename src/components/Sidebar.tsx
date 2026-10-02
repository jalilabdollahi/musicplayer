import React from "react";
import {
  AudioLines,
  Clock3,
  Disc3,
  FolderOpen,
  Heart,
  ListMusic,
  Music2,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { Playlist } from "../types/music";
import { cx } from "./ui";
import type { Route } from "../App";

interface SidebarProps {
  route: Route;
  onNavigate: (route: Route) => void;
  playlists: Playlist[];
  counts: { songs: number; favorites: number };
  onAddMusic: () => void;
  onCreatePlaylist: () => void;
  needsReconnect: boolean;
}

export function Sidebar({
  route,
  onNavigate,
  playlists,
  counts,
  onAddMusic,
  onCreatePlaylist,
  needsReconnect,
}: SidebarProps) {
  const links: { route: Route; label: string; icon: React.ReactNode; count?: number }[] = [
    { route: { kind: "songs" }, label: "Songs", icon: <Music2 size={18} />, count: counts.songs },
    { route: { kind: "albums" }, label: "Albums", icon: <Disc3 size={18} /> },
    { route: { kind: "artists" }, label: "Artists", icon: <Users size={18} /> },
    { route: { kind: "recent" }, label: "Recently added", icon: <Clock3 size={18} /> },
    { route: { kind: "favorites" }, label: "Favorites", icon: <Heart size={18} />, count: counts.favorites },
  ];

  const isActive = (r: Route) =>
    r.kind === route.kind ||
    (r.kind === "albums" && route.kind === "album") ||
    (r.kind === "artists" && route.kind === "artist");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex lg:w-64" aria-label="Library">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg transition-colors">
          <AudioLines size={18} strokeWidth={2.4} />
        </span>
        <span className="text-[17px] font-bold tracking-tight">HighFi</span>
      </div>

      <div className="px-3">
        <button
          onClick={onAddMusic}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white/[0.07] text-sm font-semibold transition hover:bg-white/[0.12]"
        >
          <Plus size={17} /> Add music
        </button>
      </div>

      <nav className="mt-5 flex flex-col gap-0.5 px-3" aria-label="Library sections">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Library</p>
        {links.map((link) => (
          <NavItem
            key={link.label}
            active={isActive(link.route)}
            onClick={() => onNavigate(link.route)}
            icon={link.icon}
            label={link.label}
            count={link.count}
          />
        ))}
      </nav>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Playlists</p>
          <button
            onClick={onCreatePlaylist}
            className="grid size-6 place-items-center rounded-full text-muted hover:bg-white/[0.08] hover:text-fg"
            aria-label="New smart playlist"
            title="New smart playlist"
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Playlists">
          {playlists.length === 0 ? (
            <button
              onClick={onCreatePlaylist}
              className="mx-3 mt-1 text-left text-[13px] leading-snug text-faint hover:text-muted"
            >
              Smart playlists fill themselves from rules you set. Create one →
            </button>
          ) : (
            playlists.map((pl) => (
              <NavItem
                key={pl.id}
                active={route.kind === "playlist" && route.id === pl.id}
                onClick={() => onNavigate({ kind: "playlist", id: pl.id })}
                icon={pl.isSmart ? <Sparkles size={17} /> : <ListMusic size={17} />}
                label={pl.name}
              />
            ))
          )}
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <NavItem
          active={route.kind === "sources"}
          onClick={() => onNavigate({ kind: "sources" })}
          icon={<FolderOpen size={18} />}
          label="Music sources"
          badge={needsReconnect}
        />
      </div>
    </aside>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  count,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors",
        active ? "bg-white/[0.08] font-medium text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
      )}
    >
      <span className={cx("shrink-0", active && "text-accent")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && <span className="size-2 rounded-full bg-amber-400" aria-label="Needs attention" />}
      {count !== undefined && count > 0 && <span className="text-xs tabular-nums text-faint">{count}</span>}
    </button>
  );
}
