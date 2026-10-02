import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Open dialogs, innermost last. Only the top one reacts to keys, so Escape in
// a dialog opened over Now Playing closes that dialog, not the player.
const stack: object[] = [];

export function Dialog({
  children,
  onClose,
  label,
  className = "",
  fullscreen = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
  /** Takes over the whole viewport instead of floating over a dimmed page. */
  fullscreen?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ) || [],
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
    (focusable()[0] || root)?.focus();
    const token = {};
    stack.push(token);
    const handleKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0],
          last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      stack.splice(stack.indexOf(token), 1);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={
        fullscreen
          ? `fixed inset-0 z-[60] ${className}`
          : `fixed inset-0 z-[60] flex items-end justify-center bg-black/65 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6 ${className}`
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={fullscreen ? "h-full w-full outline-none" : "pointer-events-none flex w-full justify-center outline-none [&>*]:pointer-events-auto"}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
