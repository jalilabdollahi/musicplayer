import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Edit3,
  Check,
  Download,
  X,
  Clock,
  Sparkles,
  AlignLeft,
} from 'lucide-react';
import { SyncedLyricLine, Track } from '../types/music';
import { formatLrcTime, getActiveLyricIndex, parseLrc, serializeToLrc } from '../services/lrcParser';

interface SyncedLyricsViewProps {
  currentTrack: Track | null;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onClose: () => void;
  onUpdateLyrics: (trackId: string, lyrics: SyncedLyricLine[], rawLrc: string) => void;
}

export const SyncedLyricsView: React.FC<SyncedLyricsViewProps> = ({
  currentTrack,
  currentTime,
  onSeek,
  onClose,
  onUpdateLyrics,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [rawText, setRawText] = useState('');
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const lyrics = currentTrack?.lyrics || [];
  const activeIndex = getActiveLyricIndex(lyrics, currentTime);

  // Auto-scroll to keep active lyric line centered
  useEffect(() => {
    if (isEditing) return;
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isEditing]);

  const handleStartEditing = () => {
    if (currentTrack) {
      setRawText(currentTrack.rawLrc || serializeToLrc(lyrics, currentTrack.title, currentTrack.artist));
      setIsEditing(true);
    }
  };

  const handleSaveLyrics = () => {
    if (!currentTrack) return;
    const parsed = parseLrc(rawText);
    onUpdateLyrics(currentTrack.id, parsed.lyrics, rawText);
    setIsEditing(false);
  };

  const handleLrcFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTrack) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseLrc(text);
        onUpdateLyrics(currentTrack.id, parsed.lyrics, text);
        setRawText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadLrc = () => {
    if (!currentTrack) return;
    const lrcContent = currentTrack.rawLrc || serializeToLrc(lyrics, currentTrack.title, currentTrack.artist);
    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTrack.artist} - ${currentTrack.title}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative flex-1 flex flex-col h-full bg-[#0a0c12] overflow-hidden select-none">
      {/* Dynamic ambient backdrop blur using album art */}
      {currentTrack?.coverArtUrl && (
        <div
          className="absolute inset-0 opacity-20 pointer-events-none filter blur-3xl scale-125 transition-all duration-1000"
          style={{
            backgroundImage: `url(${currentTrack.coverArtUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Header bar */}
      <div className="h-14 px-6 border-b border-white/[0.06] flex items-center justify-between shrink-0 z-10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-bold text-white tracking-tight">Synchronized Lyrics</span>
          </div>
          {currentTrack && (
            <span className="text-xs text-slate-400 truncate max-w-sm">
              {currentTrack.title} — {currentTrack.artist}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <button
              onClick={handleSaveLyrics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/30 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Lyrics</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleStartEditing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                title="Edit LRC Timestamps"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit LRC</span>
              </button>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-medium transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import .LRC</span>
                <input
                  type="file"
                  accept=".lrc,.txt"
                  onChange={handleLrcFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleDownloadLrc}
                className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition-colors cursor-pointer"
                title="Export .LRC file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Close Synced Lyrics (⌘+L)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Lyrics Body */}
      {isEditing ? (
        <div className="flex-1 p-6 z-10 flex flex-col">
          <div className="text-xs text-slate-400 mb-2 font-mono flex items-center justify-between">
            <span>Format: [mm:ss.xx] Lyric text</span>
            <span className="text-amber-400 font-semibold">Live LRC Editor</span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="flex-1 w-full bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-sm text-sky-200 focus:outline-none focus:border-sky-500/50 resize-none font-mono-numbers"
            placeholder="[00:12.50] Your synchronized lyrics here..."
          />
        </div>
      ) : (
        <div
          ref={lyricsContainerRef}
          className="flex-1 overflow-y-auto px-8 py-20 z-10 space-y-7 text-center transition-all scroll-smooth"
        >
          {lyrics.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <FileText className="w-12 h-12 text-slate-600 stroke-[1.5]" />
              <p className="text-base font-medium">No synced lyrics available for this track</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Drop an <span className="font-mono text-sky-400">.lrc</span> file or click "Import .LRC" to view synchronized lyrics.
              </p>
              <label className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold cursor-pointer hover:bg-sky-500/30 transition-colors">
                <Upload className="w-4 h-4" />
                <span>Upload .LRC File</span>
                <input
                  type="file"
                  accept=".lrc,.txt"
                  onChange={handleLrcFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            lyrics.map((line, index) => {
              const isActive = index === activeIndex;
              const isPast = index < activeIndex;

              return (
                <div
                  key={line.id}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => onSeek(line.time)}
                  className={`group transition-all duration-300 cursor-pointer select-none py-1.5 px-4 rounded-xl max-w-2xl mx-auto flex flex-col items-center ${
                    isActive
                      ? 'scale-105 opacity-100 text-white font-bold bg-white/[0.04]'
                      : isPast
                      ? 'opacity-40 hover:opacity-75 text-slate-300 font-medium'
                      : 'opacity-50 hover:opacity-85 text-slate-300 font-medium'
                  }`}
                >
                  <p
                    className={`transition-all leading-relaxed ${
                      isActive
                        ? 'text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-white to-amber-200 drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]'
                        : 'text-xl sm:text-2xl text-slate-300 group-hover:text-white'
                    }`}
                  >
                    {line.text}
                  </p>

                  {/* Timestamp hint on hover */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 text-[10px] text-sky-400 font-mono transition-opacity mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatLrcTime(line.time)} (Click to jump)</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
