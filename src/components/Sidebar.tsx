import React from "react";
import {
  Music2,
  Sparkles,
  Heart,
  Disc3,
  Plus,
  Wand2,
  ListMusic,
  Trash2,
  ArrowUpRight,
  HardDrive,
} from "lucide-react";
import { Playlist, Track } from "../types/music";

interface SidebarProps {
  currentView: string;
  selectedPlaylistId: string | null;
  onSelectView: (view: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  playlists: Playlist[];
  tracks: Track[];
  onOpenCreateSmartPlaylist: () => void;
  onAutoGenerateSmartPlaylists: () => void;
  onTriggerFileInput: () => void;
  onDeletePlaylist: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  selectedPlaylistId,
  onSelectView,
  onSelectPlaylist,
  playlists,
  tracks,
  onOpenCreateSmartPlaylist,
  onAutoGenerateSmartPlaylists,
  onTriggerFileInput,
  onDeletePlaylist,
}) => {
  const sections = [
    { id: "all", name: "All music", icon: Music2, count: tracks.length },
    {
      id: "favorites",
      name: "Favorites",
      icon: Heart,
      count: tracks.filter((t) => t.isFavorite).length,
    },
    {
      id: "hires",
      name: "Hi-res collection",
      icon: Sparkles,
      count: tracks.filter((t) => t.isHiRes).length,
    },
    { id: "albums", name: "Albums", icon: Disc3 },
  ];
  return (
    <aside className="library-sidebar" aria-label="Music library navigation">
      <div className="sidebar-scroll">
        <p className="eyebrow sidebar-label">Your collection</p>
        <nav className="library-links">
          {sections.map(({ id, name, icon: Icon, count }) => (
            <button
              key={id}
              className={`library-link ${currentView === id && !selectedPlaylistId ? "selected" : ""}`}
              onClick={() => onSelectView(id)}
              aria-current={
                currentView === id && !selectedPlaylistId ? "page" : undefined
              }
            >
              <Icon size={19} />
              <span>{name}</span>
              {count !== undefined && <small>{count}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-heading">
          <p className="eyebrow">Made for your music</p>
          <button
            className="icon-button"
            onClick={onOpenCreateSmartPlaylist}
            aria-label="Create smart playlist"
          >
            <Plus size={17} />
          </button>
        </div>
        <nav className="playlist-links">
          {playlists.map((pl, index) => (
            <div
              key={pl.id}
              className={`playlist-link ${selectedPlaylistId === pl.id ? "selected" : ""}`}
            >
              <button
                onClick={() => onSelectPlaylist(pl.id)}
                aria-current={selectedPlaylistId === pl.id ? "page" : undefined}
              >
                <span className={`playlist-art playlist-art-${index % 4}`}>
                  {pl.isSmart ? (
                    <Sparkles size={17} />
                  ) : (
                    <ListMusic size={17} />
                  )}
                </span>
                <span>
                  <strong>{pl.name}</strong>
                  <small>{pl.isSmart ? "Smart playlist" : "Playlist"}</small>
                </span>
              </button>
              <button
                className="playlist-delete icon-button"
                onClick={(e) => onDeletePlaylist(pl.id, e)}
                aria-label={`Delete ${pl.name}`}
                title="Delete playlist"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </nav>
        <button
          className="auto-mix-button"
          onClick={onAutoGenerateSmartPlaylists}
        >
          <Wand2 size={16} /> Create automatic mixes <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="sidebar-bottom">
        <div className="import-card">
          <span className="import-card-icon">
            <Plus size={22} />
          </span>
          <strong>Make yourself at home.</strong>
          <p>Bring your favorite tracks. We’ll keep them close.</p>
          <button className="secondary-button" onClick={onTriggerFileInput}>
            Import music <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="storage-note">
          <HardDrive size={14} />
          <span>Stored on this device</span>
          <i />
        </div>
      </div>
    </aside>
  );
};
