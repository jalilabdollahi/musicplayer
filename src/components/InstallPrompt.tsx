import React, { useEffect, useState } from "react";
import { Copy, Download, EllipsisVertical, ExternalLink, MonitorDown, PlusSquare, Share } from "lucide-react";
import { isNativeApp } from "../services/carMedia";
import { Button, Modal } from "./ui";

/**
 * In-app install offer. Browsers no longer show an install prompt on their
 * own (Chrome desktop only adds a small address-bar icon, Safari never
 * offers one), so the app surfaces it itself.
 */

/** The HTTPS address of the deployment, offered when opened over plain HTTP. */
export const SECURE_URL = "https://music.mydailyreport.xyz";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Captured at module load: the event can fire before React has mounted.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

/**
 * - prompt: the browser handed us its install dialog
 * - ios / mac-safari: install by hand from Safari's menus
 * - android-manual / desktop-manual: installable, but no dialog was offered
 *   (not yet, or the app is already installed); point at the browser menu
 * - unsupported: this browser cannot install web apps at all
 * - insecure: plain http, which no browser installs from
 */
export type InstallMode =
  | "prompt"
  | "ios"
  | "mac-safari"
  | "android-manual"
  | "desktop-manual"
  | "unsupported"
  | "insecure";

export function isStandalone(): boolean {
  return (
    isNativeApp ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectMode(): InstallMode | null {
  if (isStandalone()) return null;
  if (!window.isSecureContext) return "insecure";
  if (deferredPrompt) return "prompt";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 0)) return "ios";
  if (/Android/.test(ua)) return "android-manual";
  if (/Firefox/.test(ua)) return "unsupported";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return "mac-safari";
  return "desktop-manual";
}

export function useInstallPrompt() {
  const [state, setState] = useState(() => ({ mode: detectMode(), installed }));

  useEffect(() => {
    const update = () => setState({ mode: detectMode(), installed });
    listeners.add(update);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", update);
    update();
    return () => {
      listeners.delete(update);
      mq.removeEventListener("change", update);
    };
  }, []);

  /** Shows the browser's own dialog. Returns false when only instructions can help. */
  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    const event = deferredPrompt;
    deferredPrompt = null; // A prompt event can only be used once.
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") installed = true;
    notify();
    return true;
  };

  return { mode: state.mode, installed: state.installed, promptInstall };
}

export function InstallButton({
  mode,
  onClick,
  variant,
}: {
  mode: InstallMode;
  onClick: () => void;
  variant: "sidebar" | "appbar";
}) {
  const label = mode === "insecure" ? "Get the app" : "Install app";
  if (variant === "appbar") {
    return (
      <button
        onClick={onClick}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-fg"
      >
        <Download size={15} strokeWidth={2.4} /> {mode === "insecure" ? "App" : "Install"}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="mb-2 flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-left transition hover:bg-accent/15"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
        <Download size={16} strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">Opens in its own window, works offline</span>
      </span>
    </button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">{n}</span>
      <span className="pt-0.5 text-[15px] leading-relaxed">{children}</span>
    </li>
  );
}

const inlineIcon = "mx-0.5 -mt-1 inline text-accent";

/**
 * How to install in the current browser. `onInstall` is only used in
 * "prompt" mode, where the browser's own dialog does the work.
 */
export function InstallSteps({ mode, onInstall }: { mode: InstallMode; onInstall?: () => void }) {
  const [copied, setCopied] = useState(false);

  switch (mode) {
    case "prompt":
      return (
        <button
          onClick={onInstall}
          className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-accent text-base font-semibold text-accent-fg shadow-xl shadow-black/40 transition hover:scale-[1.02] hover:brightness-110 active:scale-100"
        >
          <Download size={20} strokeWidth={2.4} /> Install HighFi
        </button>
      );

    case "insecure":
      return (
        <>
          <p className="text-[15px] leading-relaxed text-muted">
            Browsers only install apps from secure (https) addresses. Open the secure address to install HighFi and to link music
            folders.
          </p>
          <a
            href={SECURE_URL}
            className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-accent-fg hover:brightness-110"
          >
            Open {SECURE_URL.replace("https://", "")} <ExternalLink size={16} />
          </a>
          <p className="mt-3 text-[13px] text-faint">Your library stays on this address; the secure one starts empty.</p>
        </>
      );

    case "ios":
      return (
        <ol className="flex flex-col gap-4">
          <Step n={1}>
            Tap <Share size={17} className={inlineIcon} /> <b>Share</b> in the browser toolbar.
          </Step>
          <Step n={2}>
            Scroll down and tap <PlusSquare size={17} className={inlineIcon} /> <b>Add to Home Screen</b>.
          </Step>
          <Step n={3}>
            Tap <b>Add</b>, then open HighFi from your Home Screen.
          </Step>
        </ol>
      );

    case "mac-safari":
      return (
        <ol className="flex flex-col gap-4">
          <Step n={1}>
            Open the <b>File</b> menu in the menu bar.
          </Step>
          <Step n={2}>
            Choose <b>Add to Dock…</b>, then <b>Add</b>.
          </Step>
        </ol>
      );

    case "android-manual":
      return (
        <ol className="flex flex-col gap-4">
          <Step n={1}>
            Tap the <EllipsisVertical size={17} className={inlineIcon} /> menu at the top right of the browser.
          </Step>
          <Step n={2}>
            Tap <b>Install app</b> or <b>Add to Home screen</b>.
          </Step>
          <Step n={3}>
            Tap <b>Install</b>, then open HighFi from your Home screen.
          </Step>
        </ol>
      );

    case "desktop-manual":
      return (
        <ol className="flex flex-col gap-4">
          <Step n={1}>
            Click the <MonitorDown size={17} className={inlineIcon} /> install icon at the right end of the address bar.
          </Step>
          <Step n={2}>
            No icon? Open the browser menu <EllipsisVertical size={17} className={inlineIcon} /> and choose <b>Install HighFi</b>{" "}
            (in Chrome under <b>Cast, save and share</b>, in Edge under <b>Apps</b>).
          </Step>
        </ol>
      );

    case "unsupported":
      return (
        <>
          <p className="text-[15px] leading-relaxed text-muted">
            This browser can't install web apps. Open this page in <b className="text-fg">Chrome</b> or <b className="text-fg">Edge</b> to
            install HighFi.
          </p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.origin);
                setCopied(true);
              } catch {
                // Clipboard blocked; the address bar still has the link.
              }
            }}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[15px] font-semibold hover:bg-white/15"
          >
            <Copy size={16} /> {copied ? "Link copied" : "Copy link"}
          </button>
        </>
      );
  }
}

/** Instructions dialog for the sidebar / app bar button. */
export function InstallHelpModal({ mode, onClose }: { mode: InstallMode; onClose: () => void }) {
  return (
    <Modal title="Install HighFi" subtitle={mode === "insecure" ? "This address can't be installed." : undefined} onClose={onClose} width="max-w-md">
      <InstallSteps mode={mode} />
      {mode !== "insecure" && mode !== "unsupported" && (
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      )}
    </Modal>
  );
}
