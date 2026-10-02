import React from "react";
import {
  AudioLines,
  Menu,
  SlidersHorizontal,
  HelpCircle,
  Activity,
} from "lucide-react";

interface AppHeaderProps {
  onOpenNavigation: () => void;
  onOpenEqualizer: () => void;
  onOpenShortcuts: () => void;
  showVisualizer: boolean;
  onToggleVisualizer: () => void;
}

export function AppHeader({
  onOpenNavigation,
  onOpenEqualizer,
  onOpenShortcuts,
  showVisualizer,
  onToggleVisualizer,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <button
          className="icon-button navigation-toggle"
          onClick={onOpenNavigation}
          aria-label="Open library menu"
        >
          <Menu size={21} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="HighFi Player"
        >
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          <span>
            highfi<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="header-divider" />
        <span className="header-tagline">A little closer to the music.</span>
      </div>
      <div className="header-actions">
        <span className="local-status">
          <i /> Your music, on your device
        </span>
        <button
          className={`icon-button visualizer-toggle ${showVisualizer ? "is-active" : ""}`}
          onClick={onToggleVisualizer}
          aria-label="Toggle visualizer"
          aria-pressed={showVisualizer}
          title="Visualizer"
        >
          <Activity size={19} />
        </button>
        <button
          className="studio-button"
          onClick={onOpenEqualizer}
          aria-label="Open sound studio"
        >
          <SlidersHorizontal size={18} />
          <span>Sound studio</span>
        </button>
        <button
          className="icon-button shortcuts-button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <HelpCircle size={19} />
        </button>
      </div>
    </header>
  );
}
