import React, { useEffect, useRef, useState } from "react";
import { Check, Download, MicVocal, Pencil, Upload, X } from "lucide-react";
import { SyncedLyricLine, Track } from "../types/music";
import { getActiveLyricIndex, parseLrc, serializeToLrc } from "../services/lrcParser";
import { IconButton, cx } from "./ui";

interface LyricsPanelProps {
  track: Track | null;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onUpdateLyrics: (trackId: string, lyrics: SyncedLyricLine[], rawLrc: string) => void;
}

export function LyricsPanel({ track, currentTime, onSeek, onUpdateLyrics }: LyricsPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledAt = useRef(0);

  const lyrics = track?.lyrics ?? [];
  const synced = lyrics.some((l) => l.time > 0);
  const active = synced ? getActiveLyricIndex(lyrics, currentTime) : -1;

  useEffect(() => setEditing(false), [track?.id]);

  // Follow the song, unless the listener scrolled in the last few seconds.
  useEffect(() => {
    if (editing || Date.now() - userScrolledAt.current < 4000) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, editing]);

  const startEditing = () => {
    if (!track) return;
    setDraft(track.rawLrc || serializeToLrc(lyrics, track.title, track.artist));
    setEditing(true);
  };

  const save = () => {
    if (!track) return;
    onUpdateLyrics(track.id, parseLrc(draft).lyrics, draft);
    setEditing(false);
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !track) return;
    const text = await file.text();
    onUpdateLyrics(track.id, parseLrc(text).lyrics, text);
  };

  const exportFile = () => {
    if (!track) return;
    const blob = new Blob([track.rawLrc || serializeToLrc(lyrics, track.title, track.artist)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${track.artist} - ${track.title}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importButton = (label: string, className: string) => (
    <label className={className} title="Import .lrc file" aria-label="Import .lrc file">
      <Upload size={16} /> {label}
      <input type="file" accept=".lrc,.txt" onChange={importFile} className="hidden" />
    </label>
  );

  if (!track) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 pb-2">
        {editing ? (
          <>
            <IconButton label="Cancel" size="sm" onClick={() => setEditing(false)}>
              <X size={17} />
            </IconButton>
            <button onClick={save} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-fg px-3.5 text-[13px] font-semibold text-bg">
              <Check size={15} /> Save
            </button>
          </>
        ) : (
          <>
            <IconButton label="Edit lyrics" size="sm" onClick={startEditing}>
              <Pencil size={15} />
            </IconButton>
            {importButton("", "grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-fg [&>svg]:size-4")}
            {lyrics.length > 0 && (
              <IconButton label="Export .lrc" size="sm" onClick={exportFile}>
                <Download size={16} />
              </IconButton>
            )}
          </>
        )}
      </div>

      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="Lyrics in LRC format"
            placeholder={"[00:12.50] First line\n[00:16.20] Second line"}
            className="min-h-0 flex-1 resize-none rounded-xl border border-line bg-black/30 p-4 font-mono text-[13px] leading-relaxed text-fg outline-none focus:border-line-strong"
          />
          <p className="mt-2 text-xs text-faint">One line per lyric, each starting with a [mm:ss.xx] timestamp.</p>
        </div>
      ) : lyrics.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <MicVocal size={32} className="text-faint" />
          <p className="mt-4 font-semibold">No lyrics for this song</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Add an .lrc file, or keep one next to the audio file with the same name and it's picked up automatically.
          </p>
          <div className="mt-5 flex gap-2">
            {importButton("Add .lrc", "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/15")}
            <button onClick={startEditing} className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted hover:text-fg">
              <Pencil size={15} /> Write
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onWheel={() => (userScrolledAt.current = Date.now())}
          onTouchMove={() => (userScrolledAt.current = Date.now())}
          className="min-h-0 flex-1 overflow-y-auto py-[30%] [mask-image:linear-gradient(transparent,black_15%,black_85%,transparent)]"
        >
          {lyrics.map((line, i) => (
            <button
              key={line.id}
              ref={i === active ? activeRef : null}
              onClick={() => synced && onSeek(line.time)}
              className={cx(
                "block w-full rounded-xl px-2 py-2 text-left text-2xl leading-snug font-bold tracking-tight transition-all duration-300 md:text-[28px]",
                !synced
                  ? "text-fg/80"
                  : i === active
                    ? "text-fg"
                    : i < active
                      ? "text-fg/30 hover:text-fg/60"
                      : "text-fg/40 hover:text-fg/70",
              )}
            >
              {line.text || "♪"}
              {line.translation && <span className="mt-1 block text-base font-medium text-fg/50">{line.translation}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
