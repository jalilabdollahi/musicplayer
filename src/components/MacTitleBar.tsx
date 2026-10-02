import React from 'react';
import { Sliders, Maximize2, Minimize2, Sparkles, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { Track } from '../types/music';

interface MacTitleBarProps {
  currentTrack: Track | null;
  onOpenEqualizer: () => void;
  onOpenShortcuts: () => void;
  onOpenInspector: () => void;
  showVisualizer: boolean;
  onToggleVisualizer: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const MacTitleBar: React.FC<MacTitleBarProps> = ({
  currentTrack,
  onOpenEqualizer,
  onOpenShortcuts,
  onOpenInspector,
  showVisualizer,
  onToggleVisualizer,
  isFullscreen,
  onToggleFullscreen,
}) => {
  return (
    <header className="app-titlebar h-11 bg-[#0b0e14]/90 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between px-4 select-none shrink-0 z-30">
      <div className="flex items-center gap-2">
        {/* Decorative macOS traffic lights, for the in-browser look only. The
            installed app gets real ones from the OS, so these are hidden. */}
        <div className="app-faux-window-controls flex items-center gap-2">
        <button
          onClick={() => {}}
          title="Close window (macOS command+W)"
          aria-label="Close window"
          className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all"
        >
          <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-[#4c0002] leading-none">✕</span>
        </button>
        <button
          onClick={() => {}}
          title="Minimize window (macOS command+M)"
          aria-label="Minimize window"
          className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d8a123] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all"
        >
          <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-[#5c3c00] leading-none">−</span>
        </button>
        <button
          onClick={onToggleFullscreen}
          title="Full Screen (macOS command+Ctrl+F)"
          aria-label="Full Screen"
          className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] hover:brightness-110 flex items-center justify-center group cursor-pointer transition-all"
        >
          <span className="opacity-0 group-hover:opacity-100 text-[7px] font-bold text-[#004d0d] leading-none">⤢</span>
        </button>

        <div className="h-4 w-[1px] bg-white/10 ml-2 mr-1" />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <span className="tracking-tight text-white font-bold">HIGHFI</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
            Hi-Res Studio
          </span>
        </div>
      </div>

      {/* Center: Track & Audio Status Indicator */}
      <div className="flex items-center gap-3">
        {currentTrack ? (
          <button
            onClick={onOpenInspector}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer group"
            title="Click to view detailed Hi-Res Audio inspection"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-subtle" />
            <span className="text-xs font-medium text-slate-300 group-hover:text-white truncate max-w-[200px]">
              {currentTrack.title}
            </span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20 font-semibold">
              {currentTrack.format} {currentTrack.bitDepth}b/{(currentTrack.sampleRate / 1000).toFixed(1)}k
            </span>
          </button>
        ) : (
          <span className="text-xs text-slate-500 font-medium">Ready for Lossless Playback</span>
        )}
      </div>

      {/* Right Tools: Equalizer, Visualizer, Shortcuts, Fullscreen */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleVisualizer}
          className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
            showVisualizer
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
          }`}
          title="Toggle Spectrum Visualizer"
          aria-label="Toggle Spectrum Visualizer"
        >
          {showVisualizer ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline text-[11px]">Visualizer</span>
        </button>

        <button
          onClick={onOpenEqualizer}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors flex items-center gap-1 cursor-pointer"
          title="Open 10-Band HiFi Equalizer & DSP (⌘+E)"
          aria-label="Open 10-Band HiFi Equalizer & DSP"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline text-[11px] font-medium">DSP Studio</span>
        </button>

        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer"
          title="macOS Native Keyboard Shortcuts (?)"
          aria-label="macOS Native Keyboard Shortcuts"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Full Screen' : 'Full Screen (F / ⌘+Enter)'}
          aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
