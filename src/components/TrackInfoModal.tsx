import React from "react";
import { LinkedFolder, Track } from "../types/music";
import { isLosslessFormat } from "../services/audioMetadata";
import { Artwork, Modal, formatBytes, formatTime } from "./ui";

interface TrackInfoModalProps {
  track: Track;
  folders: LinkedFolder[];
  onClose: () => void;
}

export function TrackInfoModal({ track, folders, onClose }: TrackInfoModalProps) {
  const folder = folders.find((f) => f.id === track.folderId);
  const lossless = isLosslessFormat(track.format);
  const khz = track.sampleRate ? `${(track.sampleRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kHz` : null;

  const rows: [string, string | null | undefined][] = [
    ["Format", `${track.format}${lossless ? " · lossless" : ""}`],
    ["Sample rate", khz],
    ["Bit depth", track.bitDepth ? (track.bitDepth === 1 ? "1-bit (DSD)" : `${track.bitDepth}-bit`) : null],
    ["Bitrate", track.bitrate ? `${track.bitrate.toLocaleString()} kbps${lossless ? "" : " avg"}` : null],
    ["Channels", track.channels ? (track.channels === 1 ? "Mono" : track.channels === 2 ? "Stereo" : `${track.channels} channels`) : null],
    ["Duration", track.duration ? formatTime(track.duration) : null],
    ["Genre", track.genre || null],
    ["Year", track.year ? String(track.year) : null],
    ["Track", track.trackNo ? String(track.trackNo) : null],
    ["BPM", track.bpm ? String(track.bpm) : null],
    ["File size", track.fileSize ? formatBytes(track.fileSize) : null],
    ["Location", track.source === "folder" ? `${folder?.name ?? "Linked folder"}/${track.relPath}` : `Imported · ${track.filePath ?? ""}`],
    ["Plays", String(track.playCount || 0)],
    ["Added", new Date(track.dateAdded).toLocaleDateString(undefined, { dateStyle: "medium" })],
  ];

  return (
    <Modal title="Track info" onClose={onClose}>
      <div className="flex items-center gap-4">
        <Artwork src={track.coverArtUrl} seed={track.album} className="size-20 shadow-lg shadow-black/40" rounded="rounded-lg" iconSize={28} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{track.title}</p>
          <p className="truncate text-sm text-muted">{track.artist}</p>
          <p className="truncate text-sm text-faint">{track.album}</p>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-line rounded-xl border border-line bg-white/[0.02] text-sm">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex gap-4 px-4 py-2.5">
              <dt className="w-28 shrink-0 text-muted">{label}</dt>
              <dd className="min-w-0 flex-1 break-words text-fg">{value}</dd>
            </div>
          ))}
      </dl>
    </Modal>
  );
}
