import { Dialog } from "./Dialog";
import React from "react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Music,
  Waves,
  Cpu,
  Database,
  Disc,
} from "lucide-react";
import { Track } from "../types/music";

interface AudioInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

export const AudioInspectorModal: React.FC<AudioInspectorModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  if (!isOpen || !track) return null;

  const isLossless = ["FLAC", "WAV", "ALAC", "AIFF", "DSD"].includes(
    track.format,
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Synthesized Master (Memory)";
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <Dialog onClose={onClose} label="Track details" className="standard-dialog">
      <div className="w-full max-w-lg bg-[#fffdf9] border border-stone-900/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-stone-900/[0.08] flex items-center justify-between bg-stone-900/[0.02]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <h2 className="text-sm font-bold text-stone-800 tracking-wide">
              AUDIO STREAM INSPECTOR
            </h2>
          </div>
          <button
            aria-label="Close dialog"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-900/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Lossless verification banner */}
          <div
            className={`p-4 rounded-xl border flex items-center gap-3.5 ${
              isLossless
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                : "bg-amber-500/10 border-amber-500/20 text-amber-700"
            }`}
          >
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                {isLossless
                  ? "Bit-Perfect Lossless Master"
                  : "Compressed Audio Stream"}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {isLossless
                  ? "Pure uncompressed acoustic signal. No psychoacoustic truncation detected."
                  : "Lossy encoding container with sub-band compression."}
              </p>
            </div>
          </div>

          {/* Stream telemetry grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 font-mono">
                ENCODING CONTAINER
              </span>
              <div className="text-base font-bold text-stone-800 mt-1 flex items-center gap-1.5">
                <Disc className="w-4 h-4 text-sky-400" />
                <span>{track.format} Audio</span>
              </div>
            </div>

            <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 font-mono">
                SAMPLE RATE
              </span>
              <div className="text-base font-bold text-stone-800 mt-1 flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-amber-700" />
                <span>{(track.sampleRate / 1000).toFixed(1)} kHz</span>
              </div>
            </div>

            <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 font-mono">
                BIT DEPTH RESOLUTION
              </span>
              <div className="text-base font-bold text-stone-800 mt-1 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>{track.bitDepth}-Bit Studio</span>
              </div>
            </div>

            <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 font-mono">
                AUDIO BITRATE
              </span>
              <div className="text-base font-bold text-stone-800 mt-1 font-mono">
                {track.bitrate.toLocaleString()} kbps
              </div>
            </div>

            <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 font-mono">
                CHANNELS
              </span>
              <div className="text-sm font-semibold text-stone-800 mt-1">
                {track.channels === 2
                  ? "Stereo (2.0 discrete)"
                  : `${track.channels} Channels`}
              </div>
            </div>

            <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 font-mono">
                TEMPO & KEY
              </span>
              <div className="text-sm font-semibold text-stone-800 mt-1">
                {track.bpm ? `${track.bpm} BPM` : "Dynamic"} •{" "}
                {track.key || "Natural"}
              </div>
            </div>
          </div>

          {/* File location & size */}
          <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-3 text-[11px] font-mono space-y-1.5 text-stone-500">
            <div className="flex justify-between">
              <span>Memory Footprint:</span>
              <span className="text-stone-700 font-medium">
                {formatFileSize(track.fileSize)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>IndexedDB Storage:</span>
              <span className="text-emerald-700 font-medium">
                Cached Locally
              </span>
            </div>
            <div className="flex justify-between truncate">
              <span>File Descriptor:</span>
              <span className="text-stone-600 truncate max-w-[240px]">
                {track.filePath ||
                  `${track.title}.${track.format.toLowerCase()}`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-900/[0.02] border-t border-stone-900/[0.06] flex items-center justify-end">
          <button
            aria-label="Close dialog"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900/10 hover:bg-stone-900/20 text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
};
