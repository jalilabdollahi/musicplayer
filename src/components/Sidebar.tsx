import React from 'react';
import {
  Music2,
  Sparkles,
  Heart,
  Disc,
  FolderPlus,
  Plus,
  Radio,
  Sliders,
  HardDrive,
  Moon,
  Zap,
  ShieldCheck,
  ListMusic,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Playlist, Track } from '../types/music';

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
  const hiResCount = tracks.filter((t) => t.isHiRes).length;
  const favoritesCount = tracks.filter((t) => t.isFavorite).length;

  const smartPlaylists = playlists.filter((p) => p.isSmart);
  const customPlaylists = playlists.filter((p) => !p.isSmart);

  const getPlaylistIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Moon':
        return <Moon className="w-4 h-4 text-purple-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'Heart':
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'Radio':
        return <Radio className="w-4 h-4 text-sky-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <aside className="w-64 bg-[#0d1017]/95 backdrop-blur-xl border-r border-white/[0.06] flex flex-col h-full select-none shrink-0">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Section: Library */}
        <div>
          <div className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Library
          </div>
          <nav className="space-y-0.5">
            <button
              onClick={() => onSelectView('all')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                currentView === 'all' && !selectedPlaylistId
                  ? 'bg-sky-500/15 text-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Music2 className="w-4 h-4 text-sky-400" />
                <span>All Tracks</span>
              </div>
              <span className="text-[11px] font-mono-numbers text-slate-400">{tracks.length}</span>
            </button>

            <button
              onClick={() => onSelectView('hires')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                currentView === 'hires' && !selectedPlaylistId
                  ? 'bg-amber-500/15 text-amber-400 font-semibold'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Hi-Res Lossless</span>
              </div>
              <span className="text-[11px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[10px]">
                {hiResCount}
              </span>
            </button>

            <button
              onClick={() => onSelectView('favorites')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                currentView === 'favorites' && !selectedPlaylistId
                  ? 'bg-rose-500/15 text-rose-400 font-semibold'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-400" />
                <span>Favorites</span>
              </div>
              <span className="text-[11px] font-mono-numbers text-slate-400">{favoritesCount}</span>
            </button>

            <button
              onClick={() => onSelectView('albums')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                currentView === 'albums' && !selectedPlaylistId
                  ? 'bg-indigo-500/15 text-indigo-400 font-semibold'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Disc className="w-4 h-4 text-indigo-400" />
                <span>Albums</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Section: Smart Auto-Playlists */}
        <div>
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Smart Auto-Mixes
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onAutoGenerateSmartPlaylists}
                title="Automatically generate smart playlists from audio attributes"
                aria-label="Automatically generate smart playlists from audio attributes"
                className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenCreateSmartPlaylist}
                title="Create custom smart dynamic playlist"
                aria-label="Create custom smart dynamic playlist"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <nav className="space-y-0.5">
            {smartPlaylists.map((pl) => {
              const isSelected = selectedPlaylistId === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => onSelectPlaylist(pl.id)}
                  className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-400 font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {getPlaylistIcon(pl.icon)}
                    <span className="truncate">{pl.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-white/[0.06] text-slate-400">
                      Auto
                    </span>
                    {pl.id.startsWith('smart-auto-') && (
                      <button
                        onClick={(e) => onDeletePlaylist(pl.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition-opacity"
                        title="Remove playlist"
                        aria-label="Remove playlist"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section: Custom Playlists */}
        {customPlaylists.length > 0 && (
          <div>
            <div className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              User Playlists
            </div>
            <nav className="space-y-0.5">
              {customPlaylists.map((pl) => {
                const isSelected = selectedPlaylistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl.id)}
                    className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 text-sky-400 font-semibold'
                        : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <ListMusic className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{pl.name}</span>
                    </div>
                    <button
                      onClick={(e) => onDeletePlaylist(pl.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition-opacity"
                      title="Delete playlist"
                      aria-label="Delete playlist"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Action Import Buttons */}
      <div className="p-3 border-t border-white/[0.06] space-y-2">
        <button
          onClick={onTriggerFileInput}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Import Audio Files (FLAC / WAV)</span>
        </button>

        {/* Offline Cache Status */}
        <div className="flex items-center justify-between px-1.5 text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3 h-3 text-emerald-400" />
            <span>IndexedDB Offline</span>
          </div>
          <span className="text-emerald-400 font-semibold">Ready</span>
        </div>
      </div>
    </aside>
  );
};
