import React from "react";
import { CheckCircle2, HardDrive, WifiOff, AppWindow } from "lucide-react";
import { InstallMode, InstallSteps } from "./InstallPrompt";

/**
 * Full-screen install screen shown in front of the player whenever HighFi is
 * opened in a browser tab rather than as the installed app. "Continue in
 * browser" lets anyone through, since a tab can't always tell whether the app
 * is already installed; the screen returns on the next visit.
 */

const DISMISS_KEY = "highfi.installGateDismissed";

export function installGateDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Storage blocked: the screen will simply show again on reload.
  }
}

const PERKS = [
  { icon: <AppWindow size={18} />, text: "Opens in its own window, right from your Home Screen or Dock" },
  { icon: <WifiOff size={18} />, text: "Works offline, with no internet connection needed" },
  { icon: <HardDrive size={18} />, text: "Plays the music on your device; nothing is uploaded" },
];

export function InstallGate({
  mode,
  installed,
  onInstall,
  onContinue,
}: {
  mode: InstallMode;
  installed: boolean;
  onInstall: () => void;
  onContinue: () => void;
}) {
  const manual = mode !== "prompt" && mode !== "insecure" && mode !== "unsupported";

  return (
    <div role="dialog" aria-modal="true" aria-label="Install HighFi" className="fixed inset-0 z-[100] overflow-y-auto bg-bg animate-fade-in">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: "radial-gradient(ellipse at 50% -10%, color-mix(in oklab, var(--accent) 38%, transparent), transparent 60%)" }}
      />
      <div className="pt-safe pb-safe relative mx-auto flex min-h-full max-w-md flex-col items-center px-6 py-10 text-center">
        <div className="flex flex-1 flex-col items-center justify-center">
          <img src="/icon-512.png?v=2" alt="" className="size-24 rounded-[28px] shadow-2xl shadow-black/60" />
          <h1 className="mt-7 text-3xl font-bold tracking-tight">{installed ? "HighFi is installed" : "Install HighFi"}</h1>
          <p className="mt-2 text-[15px] text-muted text-balance">
            {installed
              ? "Open it from your Home Screen, Dock or apps list. You can close this tab."
              : "HighFi works best as an app. It only takes a few seconds."}
          </p>

          {installed ? (
            <CheckCircle2 size={56} className="mt-8 text-accent" />
          ) : (
            <>
              <ul className="mt-8 flex w-full flex-col gap-3 text-left">
                {PERKS.map((perk) => (
                  <li key={perk.text} className="flex items-center gap-3 text-sm text-fg/85">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">{perk.icon}</span>
                    {perk.text}
                  </li>
                ))}
              </ul>

              <div className="mt-8 w-full rounded-2xl border border-line bg-white/[0.04] p-5">
                <InstallSteps mode={mode} onInstall={onInstall} />
              </div>
              {manual && <p className="mt-3 text-[13px] text-faint">Already installed? Open HighFi from your apps instead of the browser.</p>}
            </>
          )}
        </div>

        <button
          onClick={() => {
            rememberDismissal();
            onContinue();
          }}
          className="mt-10 text-sm text-faint underline-offset-4 hover:text-muted hover:underline"
        >
          Continue in browser
        </button>
      </div>
    </div>
  );
}
