import React from "react";
import { cx } from "./ui";

/** The HF monogram, drawn the same way as the app icon in public/. */
export function AppLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cx("shrink-0 overflow-hidden rounded-lg", className)}>
      <rect width="512" height="512" fill="#121019" />
      <g fill="#fff">
        <rect x="118" y="136" width="46" height="240" rx="10" />
        <rect x="232" y="136" width="46" height="240" rx="10" />
        <rect x="140" y="234" width="116" height="42" rx="8" />
        <rect x="250" y="136" width="146" height="44" rx="10" />
      </g>
      <g stroke="#c98bff" strokeWidth="22" strokeLinecap="round">
        <line x1="314" y1="226" x2="314" y2="286" />
        <line x1="352" y1="210" x2="352" y2="302" />
        <line x1="390" y1="236" x2="390" y2="276" />
      </g>
    </svg>
  );
}
