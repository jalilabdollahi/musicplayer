import React from "react";
import { Modal } from "./ui";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const mod = isMac ? "⌘" : "Ctrl";
const alt = isMac ? "⌥" : "Alt";

const SHORTCUTS: [string, string[]][] = [
  ["Play / pause", ["Space"]],
  ["Next song", [mod, "→"]],
  ["Previous song", [mod, "←"]],
  ["Skip forward 5 s", [alt, "→"]],
  ["Skip back 5 s", [alt, "←"]],
  ["Volume up / down", [mod, "↑ ↓"]],
  ["Mute", [mod, "M"]],
  ["Shuffle", [mod, "S"]],
  ["Repeat", [mod, "R"]],
  ["Playback speed (1x / 1.5x / 2x)", [mod, "."]],
  ["Lyrics", [mod, "L"]],
  ["Equalizer", [mod, "E"]],
  ["Search", ["/"]],
  ["Close", ["Esc"]],
  ["This list", ["?"]],
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width="max-w-md">
      <ul className="divide-y divide-line">
        {SHORTCUTS.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-muted">{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="min-w-7 rounded-md border border-line-strong bg-white/[0.06] px-2 py-0.5 text-center font-sans text-xs font-semibold text-fg">
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
