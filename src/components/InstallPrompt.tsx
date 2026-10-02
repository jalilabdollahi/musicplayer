import React, { useEffect, useState } from "react";
import { Download, ExternalLink, PlusSquare, Share } from "lucide-react";
import { Button, Modal, cx } from "./ui";

/**
 * In-app install offer. Browsers no longer show an install prompt on their
 * own (Chrome desktop only adds a small address-bar icon, Safari never
 * offers one), so the app surfaces it itself.
 */

/** The HTTPS address of the deployment, offered when opened over plain HTTP. */
const SECURE_URL = "https://music.mydailyreport.xyz";

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

export type InstallMode = "prompt" | "ios" | "mac-safari" | "insecure";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectMode(): InstallMode | null {
  if (installed || isStandalone()) return null;
  if (!window.isSecureContext) return "insecure";
  if (deferredPrompt) return "prompt";
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua);
  if (safari && /Macintosh/.test(ua)) return "mac-safari";
  return null;
}

export function useInstallPrompt() {
  const [mode, setMode] = useState<InstallMode | null>(detectMode);

  useEffect(() => {
    const update = () => setMode(detectMode());
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

  return { mode, promptInstall };
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
      className={cx(
        "mb-2 flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-left transition hover:bg-accent/15",
      )}
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
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">{n}</span>
      <span className="pt-0.5 text-[15px] leading-relaxed">{children}</span>
    </li>
  );
}

/** Instructions for browsers without an install API, and for plain HTTP. */
export function InstallHelpModal({ mode, onClose }: { mode: InstallMode; onClose: () => void }) {
  if (mode === "insecure") {
    return (
      <Modal title="Install HighFi" subtitle="This address can't be installed." onClose={onClose} width="max-w-md">
        <p className="text-[15px] leading-relaxed text-muted">
          Browsers only install apps from secure (https) addresses. Open the secure address to install HighFi and to link music
          folders.
        </p>
        <a
          href={SECURE_URL}
          className="mt-5 flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-fg hover:brightness-110"
        >
          Open {SECURE_URL.replace("https://", "")} <ExternalLink size={15} />
        </a>
        <p className="mt-4 text-[13px] text-faint">Your library stays on this address; the secure one starts empty.</p>
      </Modal>
    );
  }

  if (mode === "mac-safari") {
    return (
      <Modal title="Install HighFi" subtitle="Add it to your Dock from Safari." onClose={onClose} width="max-w-md">
        <ol className="flex flex-col gap-4">
          <Step n={1}>
            Open the <b>File</b> menu in the menu bar.
          </Step>
          <Step n={2}>
            Choose <b>Add to Dock…</b>, then <b>Add</b>.
          </Step>
        </ol>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Install HighFi" subtitle="Add it to your Home Screen." onClose={onClose} width="max-w-md">
      <ol className="flex flex-col gap-4">
        <Step n={1}>
          Tap <Share size={17} className="mx-0.5 -mt-1 inline text-accent" /> <b>Share</b> in the browser toolbar.
        </Step>
        <Step n={2}>
          Scroll down and tap <PlusSquare size={17} className="mx-0.5 -mt-1 inline text-accent" /> <b>Add to Home Screen</b>.
        </Step>
        <Step n={3}>
          Tap <b>Add</b>. HighFi opens from your Home Screen like any other app.
        </Step>
      </ol>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
