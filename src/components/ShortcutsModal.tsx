import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause playback' },
    { key: '⌘ + →', desc: 'Next track' },
    { key: '⌘ + ←', desc: 'Previous track' },
    { key: '⌥ + →', desc: 'Seek forward 5 seconds' },
    { key: '⌥ + ←', desc: 'Seek backward 5 seconds' },
    { key: '⌘ + ↑', desc: 'Increase master volume' },
    { key: '⌘ + ↓', desc: 'Decrease master volume' },
    { key: '⌘ + M', desc: 'Mute / Unmute audio' },
    { key: '⌘ + S', desc: 'Toggle Shuffle mode' },
    { key: '⌘ + R', desc: 'Cycle Repeat (Off / All / One)' },
    { key: '⌘ + L', desc: 'Toggle Synced Lyrics view' },
    { key: '⌘ + E', desc: 'Open 10-Band HiFi DSP Equalizer' },
    { key: '⌘ + F or /', desc: 'Focus library search' },
    { key: 'F or ⌘ + Enter', desc: 'Toggle Fullscreen mode' },
    { key: 'Esc', desc: 'Close open dialogs or lyrics' },
    { key: '?', desc: 'Show this shortcuts guide' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-lg bg-[#0e111a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              macOS NATIVE DESKTOP SHORTCUTS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of shortcuts */}
        <div className="p-6 divide-y divide-white/[0.04] max-h-[65vh] overflow-y-auto">
          {shortcuts.map((sc, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{sc.desc}</span>
              <kbd className="px-2.5 py-1 rounded bg-white/[0.08] border border-white/15 text-sky-300 font-mono text-[11px] shadow-sm flex items-center gap-1 font-semibold">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Standard macOS Command (⌘) and Option (⌥) keys</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-500 text-black font-semibold text-xs hover:bg-sky-400 transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
