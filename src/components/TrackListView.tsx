import React, { useState } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Search,
  Sparkles,
  Heart,
  Clock,
  Music,
  Plus,
  ArrowUpDown,
  FolderDown,
  Info,
  Sliders,
} from 'lucide-react';
import { AudioFormat, Track } from '../types/music';

interface TrackListViewProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onPlayAll: (tracks: Track[], shuffle: boolean) => void;
  onToggleFavorite: (trackId: string) => void;
  onInspectTrack: (track: Track) => void;
  onFilesDropped: (files: FileList) => void;
  onTriggerFileInput: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  formatFilter: string;
  onFormatFilterChange: (fmt: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const TrackListView: React.FC<TrackListViewProps> = ({
  title,
  subtitle,
  tracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onPlayAll,
  onToggleFavorite,
  onInspectTrack,
  onFilesDropped,
  onTriggerFileInput,
  searchQuery,
  onSearchChange,
  formatFilter,
  onFormatFilterChange,
  searchInputRef,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortField, setSortField] = useState<'title' | 'artist' | 'duration' | 'sampleRate' | 'bitrate'>('title');
  const [sortAsc, setSortAsc] = useState(true);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort tracks
  const sortedTracks = [...tracks].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'title') cmp = a.title.localeCompare(b.title);
    else if (sortField === 'artist') cmp = a.artist.localeCompare(b.artist);
    else if (sortField === 'duration') cmp = a.duration - b.duration;
    else if (sortField === 'sampleRate') cmp = a.sampleRate - b.sampleRate;
    else if (sortField === 'bitrate') cmp = a.bitrate - b.bitrate;
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 flex flex-col h-full bg-[#0a0c12] overflow-hidden select-none"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-sky-950/80 backdrop-blur-md border-2 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none animate-pulse">
          <FolderDown className="w-16 h-16 text-sky-400 mb-3" />
          <h3 className="text-xl font-bold text-white">Drop High-Fidelity Audio Files Here</h3>
          <p className="text-sm text-sky-300 mt-1">FLAC, WAV, ALAC, AIFF, DSD, MP3 & LRC lyrics files</p>
        </div>
      )}

      {/* Header and Controls Area */}
      <div className="p-6 pb-3 border-b border-white/[0.06] shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>{title}</span>
              <span className="text-xs font-mono font-normal text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/10">
                {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
              </span>
            </h1>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>

          {/* Quick Play Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPlayAll(sortedTracks, false)}
              disabled={sortedTracks.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-md shadow-white/10 cursor-pointer disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play All</span>
            </button>

            <button
              onClick={() => onPlayAll(sortedTracks, true)}
              disabled={sortedTracks.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer disabled:opacity-40"
            >
              <Shuffle className="w-3.5 h-3.5 text-sky-400" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={onTriggerFileInput}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all cursor-pointer"
              title="Add local audio files"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Files</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search title, artist, genre (⌘+F)"
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60"
            />
          </div>

          {/* Format Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'hires', 'FLAC', 'WAV', 'DSD', 'ALAC', 'MP3'].map((fmt) => (
              <button
                key={fmt}
                onClick={() => onFormatFilterChange(fmt)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer border whitespace-nowrap ${
                  formatFilter === fmt
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold'
                    : 'bg-white/[0.02] text-slate-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                {fmt === 'all' ? 'All' : fmt === 'hires' ? 'Hi-Res (24b+)' : fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Track Table Header */}
      <div className="grid grid-cols-12 gap-3 px-6 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-white/[0.04] shrink-0">
        <div className="col-span-1 text-center">#</div>
        <div
          onClick={() => handleSort('title')}
          className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-slate-300"
        >
          <span>Title & Artist</span>
          {sortField === 'title' && <ArrowUpDown className="w-2.5 h-2.5 text-sky-400" />}
        </div>
        <div className="col-span-2 hidden md:block">Album</div>
        <div
          onClick={() => handleSort('sampleRate')}
          className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-300"
        >
          <span>Hi-Res Format</span>
          {sortField === 'sampleRate' && <ArrowUpDown className="w-2.5 h-2.5 text-sky-400" />}
        </div>
        <div
          onClick={() => handleSort('duration')}
          className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-slate-300 pr-2"
        >
          <Clock className="w-3 h-3" />
          {sortField === 'duration' && <ArrowUpDown className="w-2.5 h-2.5 text-sky-400" />}
        </div>
      </div>

      {/* Track Rows List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 divide-y divide-white/[0.02]">
        {sortedTracks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-center space-y-3">
            <Music className="w-12 h-12 text-slate-700 stroke-[1.5]" />
            <p className="text-sm font-medium">No tracks found matching your filter</p>
            <p className="text-xs text-slate-600 max-w-xs">
              Drag and drop local audio files (FLAC, WAV, ALAC, DSD) anywhere onto this window to add them.
            </p>
          </div>
        ) : (
          sortedTracks.map((track, index) => {
            const isCurrent = track.id === currentTrackId;

            return (
              <div
                key={track.id}
                onDoubleClick={() => onPlayTrack(track)}
                className={`group grid grid-cols-12 gap-3 items-center px-3 py-2 rounded-xl transition-all select-none cursor-pointer ${
                  isCurrent
                    ? 'bg-sky-500/10 border border-sky-500/25 shadow-sm'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {/* Index / Play Button */}
                <div className="col-span-1 flex items-center justify-center text-xs">
                  {isCurrent && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-4">
                      <span className="w-0.5 h-3 bg-sky-400 animate-pulse" />
                      <span className="w-0.5 h-4 bg-sky-300 animate-bounce" />
                      <span className="w-0.5 h-2 bg-sky-400 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <span className="group-hover:hidden text-slate-400 font-mono text-xs">
                        {index + 1}
                      </span>
                      <button
                        onClick={() => onPlayTrack(track)}
                        className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white text-black hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current translate-x-0.2" />
                      </button>
                    </>
                  )}
                </div>

                {/* Title & Artist & Cover */}
                <div className="col-span-5 flex items-center gap-3 truncate min-w-0">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-white/10">
                    <img
                      src={track.coverArtUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="truncate min-w-0">
                    <div
                      className={`text-xs font-semibold truncate ${
                        isCurrent ? 'text-sky-300' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{track.artist}</div>
                  </div>
                </div>

                {/* Album */}
                <div className="col-span-2 hidden md:block text-xs text-slate-400 truncate">
                  {track.album}
                </div>

                {/* Format Badge */}
                <div className="col-span-2 flex items-center gap-1.5 truncate">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectTrack(track);
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer border ${
                      track.isHiRes
                        ? 'bg-amber-400/10 text-amber-300 border-amber-400/30 hover:bg-amber-400/20'
                        : 'bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08]'
                    }`}
                    title="Click for full audio stream inspection"
                  >
                    <span>{track.format}</span>
                    <span className="opacity-80">
                      {track.bitDepth}b/{(track.sampleRate / 1000).toFixed(0)}k
                    </span>
                  </span>
                  {track.bpm && (
                    <span className="hidden lg:inline text-[9px] font-mono text-slate-400">
                      {track.bpm}bpm
                    </span>
                  )}
                </div>

                {/* Duration & Favorite Actions */}
                <div className="col-span-2 flex items-center justify-end gap-3 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(track.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        track.isFavorite ? 'text-rose-500 fill-rose-500' : ''
                      }`}
                    />
                  </button>

                  <span className="text-xs font-mono-numbers text-slate-400 w-10 text-right">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
