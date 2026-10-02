import React, { useState } from 'react';
import { X, Sparkles, Wand2, SlidersHorizontal, Check } from 'lucide-react';
import { AudioFormat, Playlist, SmartPlaylistRule, Track } from '../types/music';
import { matchesSmartRule } from '../services/smartPlaylists';

interface SmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  onSaveSmartPlaylist: (playlist: Playlist) => void;
}

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onSaveSmartPlaylist,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [onlyHiRes, setOnlyHiRes] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<AudioFormat[]>([]);
  const [minSampleRate, setMinSampleRate] = useState<number>(0);
  const [minBitDepth, setMinBitDepth] = useState<number>(0);
  const [minBpm, setMinBpm] = useState<string>('');
  const [maxBpm, setMaxBpm] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [genreQuery, setGenreQuery] = useState('');
  const [sortBy, setSortBy] = useState<SmartPlaylistRule['sortBy']>('sampleRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const currentRule: SmartPlaylistRule = {
    onlyHiRes,
    formats: selectedFormats.length > 0 ? selectedFormats : undefined,
    minSampleRate: minSampleRate > 0 ? minSampleRate : undefined,
    minBitDepth: minBitDepth > 0 ? minBitDepth : undefined,
    minBpm: minBpm ? parseInt(minBpm, 10) : undefined,
    maxBpm: maxBpm ? parseInt(maxBpm, 10) : undefined,
    onlyFavorites: onlyFavorites || undefined,
    genres: genreQuery ? [genreQuery] : undefined,
    sortBy,
    sortOrder,
  };

  const matchingTracksCount = tracks.filter((t) => matchesSmartRule(t, currentRule)).length;

  const toggleFormat = (fmt: AudioFormat) => {
    if (selectedFormats.includes(fmt)) {
      setSelectedFormats(selectedFormats.filter((f) => f !== fmt));
    } else {
      setSelectedFormats([...selectedFormats, fmt]);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPlaylist: Playlist = {
      id: `smart-user-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'Dynamic smart auto-playlist with custom criteria.',
      isSmart: true,
      icon: 'Sparkles',
      coverGradient: 'from-sky-500/30 via-indigo-500/20 to-purple-900/40',
      rule: currentRule,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onSaveSmartPlaylist(newPlaylist);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-xl bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              CREATE DYNAMIC SMART PLAYLIST
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Playlist Info */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Playlist Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 24-Bit Acoustic Masters"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Automatically aggregates lossless tracks with relaxed tempo"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500/60"
              />
            </div>
          </div>

          <div className="h-[1px] bg-white/[0.06]" />

          {/* Smart Rule Criteria */}
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Smart Filtering Criteria</span>
            </div>

            {/* Quick toggles */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={onlyHiRes}
                  onChange={(e) => setOnlyHiRes(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 accent-amber-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Lossless Hi-Res Only</div>
                  <div className="text-[10px] text-slate-400">FLAC/WAV/DSD 24-bit+</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={onlyFavorites}
                  onChange={(e) => setOnlyFavorites(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 accent-rose-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Favorites Only</div>
                  <div className="text-[10px] text-slate-400">Tracks you have starred</div>
                </div>
              </label>
            </div>

            {/* Audio Formats */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Allowed Audio Formats
              </label>
              <div className="flex flex-wrap gap-2">
                {(['FLAC', 'WAV', 'ALAC', 'AIFF', 'DSD', 'MP3'] as AudioFormat[]).map((fmt) => {
                  const isChecked = selectedFormats.includes(fmt);
                  return (
                    <button
                      type="button"
                      key={fmt}
                      onClick={() => toggleFormat(fmt)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer border ${
                        isChecked
                          ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                          : 'bg-white/[0.02] text-slate-400 border-white/[0.06] hover:bg-white/[0.05]'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Min Sample Rate & Bit Depth */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Min Sample Rate
                </label>
                <select
                  value={minSampleRate}
                  onChange={(e) => setMinSampleRate(parseInt(e.target.value, 10))}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/60"
                >
                  <option value={0}>Any Sample Rate</option>
                  <option value={44100}>44.1 kHz (CD Quality)</option>
                  <option value={48000}>48.0 kHz (Studio)</option>
                  <option value={88200}>88.2 kHz (Hi-Res)</option>
                  <option value={96000}>96.0 kHz (Master)</option>
                  <option value={192000}>192.0 kHz (Ultra Hi-Res)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Min Bit Depth
                </label>
                <select
                  value={minBitDepth}
                  onChange={(e) => setMinBitDepth(parseInt(e.target.value, 10))}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/60"
                >
                  <option value={0}>Any Bit Depth</option>
                  <option value={16}>16-bit (CD Redbook)</option>
                  <option value={24}>24-bit (Studio Master)</option>
                  <option value={32}>32-bit (Audiophile float)</option>
                </select>
              </div>
            </div>

            {/* BPM Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Min BPM (Tempo)
                </label>
                <input
                  type="number"
                  value={minBpm}
                  onChange={(e) => setMinBpm(e.target.value)}
                  placeholder="e.g. 70"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Max BPM (Tempo)
                </label>
                <input
                  type="number"
                  value={maxBpm}
                  onChange={(e) => setMaxBpm(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Genre filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Genre Keyword
              </label>
              <input
                type="text"
                value={genreQuery}
                onChange={(e) => setGenreQuery(e.target.value)}
                placeholder="e.g. Jazz, Electronic, Classical, Ambient"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
            <span className="text-xs text-sky-300 font-medium">
              Currently matches in your library:
            </span>
            <span className="text-sm font-bold font-mono text-sky-400">
              {matchingTracksCount} {matchingTracksCount === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Create Smart Playlist</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
