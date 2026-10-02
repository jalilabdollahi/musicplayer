import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, X } from "lucide-react";
import { Dialog } from "./Dialog";
import { Track } from "../types/music";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatTotal(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Short quality label: "FLAC 24/96", "MP3 320", "AAC". */
export function qualityLabel(track: Track): string {
  if (track.bitDepth && track.sampleRate) {
    const khz = track.sampleRate / 1000;
    return `${track.format} ${track.bitDepth}/${Number.isInteger(khz) ? khz : khz.toFixed(1)}`;
  }
  if (track.bitrate && !["FLAC", "ALAC", "WAV", "AIFF", "DSD"].includes(track.format)) {
    return `${track.format} ${track.bitrate}`;
  }
  return track.format;
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/** Deterministic colour pair for tracks without embedded artwork. */
export function placeholderGradient(seed: string): string {
  const hue = hashHue(seed || "music");
  return `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${(hue + 50) % 360} 48% 16%))`;
}

export function Artwork({
  src,
  seed,
  className = "",
  rounded = "rounded-md",
  iconSize = 18,
  alt = "",
}: {
  src?: string;
  seed: string;
  className?: string;
  rounded?: string;
  iconSize?: number;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className={cx("block shrink-0 object-cover bg-raised", rounded, className)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cx("grid shrink-0 place-items-center text-white/70", rounded, className)}
      style={{ background: placeholderGradient(seed) }}
    >
      <Music2 size={iconSize} strokeWidth={1.75} />
    </div>
  );
}

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    active?: boolean;
    size?: "sm" | "md" | "lg";
  }
>(function IconButton({ label, active, size = "md", className = "", children, ...rest }, ref) {
  const dims = size === "sm" ? "size-8" : size === "lg" ? "size-11" : "size-9";
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "relative inline-grid shrink-0 place-items-center rounded-full transition-colors disabled:opacity-35",
        dims,
        active ? "text-accent" : "text-muted hover:text-fg",
        "hover:bg-white/[0.06] active:bg-white/[0.1]",
        className,
      )}
      {...rest}
    >
      {children}
      {active && <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
    </button>
  );
});

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-accent text-accent-fg hover:brightness-110",
    secondary: "bg-white/[0.08] text-fg hover:bg-white/[0.13]",
    ghost: "text-muted hover:text-fg hover:bg-white/[0.06]",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
  }[variant];
  return (
    <button
      type="button"
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-40",
        styles,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-white/15",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

/** Three bouncing bars marking the playing row. */
export function PlayingBars({ paused = false }: { paused?: boolean }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0, 250, 500].map((delay) => (
        <span
          key={delay}
          className="w-[3px] origin-bottom rounded-full bg-accent animate-eq"
          style={{ height: "100%", animationDelay: `${-delay}ms`, animationPlayState: paused ? "paused" : "running" }}
        />
      ))}
    </span>
  );
}

/** Centered dialog panel with a title bar. Becomes a bottom sheet on phones. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "max-w-lg",
  actions,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Dialog label={title} onClose={onClose}>
      <div
        className={cx(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-raised shadow-2xl shadow-black/60",
          "rounded-t-3xl animate-sheet-in sm:rounded-2xl sm:animate-pop-in",
          width,
        )}
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions}
          <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1.5">
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-safe sm:px-6">{footer}</footer>}
      </div>
    </Dialog>
  );
}

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** Popover menu anchored to a button. Closes on outside click, scroll or Escape. */
export function Menu({
  anchor,
  items,
  onClose,
}: {
  anchor: DOMRect;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: anchor.bottom + 6, left: anchor.right - 220 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { height, width } = el.getBoundingClientRect();
    let top = anchor.bottom + 6;
    if (top + height > window.innerHeight - 12) top = Math.max(12, anchor.top - height - 6);
    const left = Math.min(Math.max(12, anchor.right - width), window.innerWidth - width - 12);
    setPos({ top, left });
    el.querySelector<HTMLButtonElement>("button")?.focus();
  }, [anchor]);

  useEffect(() => {
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", close, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", close, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[70] w-56 overflow-hidden rounded-xl border border-line-strong bg-overlay p-1 shadow-2xl shadow-black/60 animate-pop-in"
      style={pos}
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          type="button"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={cx(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-white/[0.07] focus-visible:bg-white/[0.07]",
            item.danger ? "text-danger" : "text-fg",
          )}
        >
          <span className="text-muted [&>svg]:size-4">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Accent colour

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

/** Most characterful colour in an image, from a 24×24 downsample. */
async function dominantHue(src: string): Promise<[number, number] | null> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 24, 24);
  const data = ctx.getImageData(0, 0, 24, 24).data;

  // Hue histogram weighted by saturation, ignoring near-greys and extremes.
  const buckets = new Array(36).fill(0);
  const sat = new Array(36).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.2 || l < 0.12 || l > 0.9) continue;
    const bucket = Math.floor(h / 10) % 36;
    const weight = s * (1 - Math.abs(l - 0.5));
    buckets[bucket] += weight;
    sat[bucket] += s * weight;
  }
  let best = -1;
  for (let i = 0; i < 36; i++) if (best < 0 || buckets[i] > buckets[best]) best = i;
  if (best < 0 || buckets[best] < 0.5) return null;
  return [best * 10 + 5, sat[best] / buckets[best]];
}

/**
 * Re-tints the UI from the current artwork. Colours are clamped into a range
 * that stays legible on the dark background.
 */
export function useArtworkAccent(src: string | undefined, seed: string) {
  useEffect(() => {
    let cancelled = false;
    const apply = (hue: number, saturation: number) => {
      if (cancelled) return;
      const s = Math.round(Math.min(0.85, Math.max(0.45, saturation)) * 100);
      // Yellows and greens read brighter at the same lightness.
      const l = hue > 40 && hue < 170 ? 58 : 68;
      const root = document.documentElement.style;
      root.setProperty("--accent", `hsl(${Math.round(hue)} ${s}% ${l}%)`);
      root.setProperty("--accent-fg", "#0b0b0e");
    };
    if (src) {
      dominantHue(src).then((found) => (found ? apply(found[0], found[1]) : apply(hashHue(seed), 0.55)));
    } else if (seed) {
      apply(hashHue(seed), 0.55);
    } else {
      document.documentElement.style.removeProperty("--accent");
    }
    return () => {
      cancelled = true;
    };
  }, [src, seed]);
}
