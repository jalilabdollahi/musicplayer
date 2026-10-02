import React, { useState } from "react";
import { AudioFormat, Playlist, SmartPlaylistRule, Track } from "../types/music";
import { matchesSmartRule } from "../services/smartPlaylists";
import { Button, Modal, Switch, cx } from "./ui";

interface SmartPlaylistModalProps {
  onClose: () => void;
  tracks: Track[];
  onSave: (playlist: Playlist) => void;
}

const FORMATS: AudioFormat[] = ["FLAC", "ALAC", "WAV", "AIFF", "DSD", "MP3", "AAC", "M4A", "OGG", "OPUS"];

const SORTS: { value: SmartPlaylistRule["sortBy"]; label: string; order: "asc" | "desc" }[] = [
  { value: "dateAdded", label: "Recently added", order: "desc" },
  { value: "playCount", label: "Most played", order: "desc" },
  { value: "title", label: "Title", order: "asc" },
  { value: "artist", label: "Artist", order: "asc" },
];

const field = "h-10 w-full rounded-xl border border-line bg-black/25 px-3.5 text-sm outline-none focus:border-line-strong";

export function SmartPlaylistModal({ onClose, tracks, onSave }: SmartPlaylistModalProps) {
  const [name, setName] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyHiRes, setOnlyHiRes] = useState(false);
  const [formats, setFormats] = useState<AudioFormat[]>([]);
  const [genre, setGenre] = useState("");
  const [minPlays, setMinPlays] = useState("");
  const [sortBy, setSortBy] = useState<SmartPlaylistRule["sortBy"]>("dateAdded");
  const [limit, setLimit] = useState("");

  const sort = SORTS.find((s) => s.value === sortBy)!;
  const rule: SmartPlaylistRule = {
    onlyFavorites: onlyFavorites || undefined,
    onlyHiRes: onlyHiRes || undefined,
    formats: formats.length ? formats : undefined,
    genres: genre.trim() ? [genre.trim()] : undefined,
    minPlayCount: minPlays ? parseInt(minPlays, 10) : undefined,
    sortBy,
    sortOrder: sort.order,
    limit: limit ? parseInt(limit, 10) : undefined,
  };
  const matches = tracks.filter((t) => matchesSmartRule(t, rule)).length;
  const shown = rule.limit ? Math.min(rule.limit, matches) : matches;

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    const now = Date.now();
    onSave({
      id: `smart-user-${now}`,
      name: name.trim(),
      description: "",
      isSmart: true,
      rule,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
    });
    onClose();
  };

  return (
    <Modal
      title="New smart playlist"
      subtitle="Songs that match these rules are added automatically."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">
            {shown} {shown === 1 ? "song" : "songs"} match
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Late night lossless" className={field} />
        </label>

        <div className="divide-y divide-line rounded-xl border border-line">
          <label className="flex items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Favorites only</span>
              <span className="block text-xs text-muted">Songs you've hearted</span>
            </span>
            <Switch label="Favorites only" checked={onlyFavorites} onChange={setOnlyFavorites} />
          </label>
          <label className="flex items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Hi-res only</span>
              <span className="block text-xs text-muted">Lossless above CD quality (24-bit or over 48 kHz)</span>
            </span>
            <Switch label="Hi-res only" checked={onlyHiRes} onChange={setOnlyHiRes} />
          </label>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">Formats</span>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => {
              const on = formats.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFormats(on ? formats.filter((x) => x !== f) : [...formats, f])}
                  className={cx(
                    "h-8 rounded-full px-3 text-xs font-semibold tracking-wide transition",
                    on ? "bg-fg text-bg" : "bg-white/[0.07] text-muted hover:text-fg",
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-faint">None selected means any format.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Genre contains</span>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Jazz" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Played at least</span>
            <input type="number" min={0} value={minPlays} onChange={(e) => setMinPlays(e.target.value)} placeholder="0 times" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Order</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SmartPlaylistRule["sortBy"])} className={field}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Limit</span>
            <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" className={field} />
          </label>
        </div>
      </form>
    </Modal>
  );
}
