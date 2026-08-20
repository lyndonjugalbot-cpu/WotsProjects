"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Optional — wires up aria-labelledby automatically. Pass this instead of (or alongside) your own heading when you want the dialog's accessible name set for you. */
  title?: string;
  /** Hides the visible close (×) button — use only when the dialog already provides its own explicit way out (e.g. a form with Cancel/Submit buttons) and a redundant close control would be visual noise. Escape and the backdrop click still work either way. */
  hideCloseButton?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Overlay dialog — click outside, Escape, or the close button to dismiss.
 * Traps Tab/Shift+Tab focus within the dialog while open (a plain
 * `autofocus`-on-open isn't enough on its own: without a trap, Tabbing
 * forward eventually walks focus out into the page behind the backdrop,
 * which a screen reader user has no way to know is supposed to be inert).
 */
export function Modal({ open, onClose, children, className, title, hideCloseButton }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-[2px] motion-safe:animate-[fade-in_150ms_ease-out]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "flex max-h-[90vh] w-full max-w-2xl flex-col overflow-auto rounded-xl bg-card p-6 shadow-lg outline-none",
          "motion-safe:animate-[modal-in_150ms_ease-out]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {(title || !hideCloseButton) && (
          <div className="mb-1 flex items-start justify-between gap-4">
            {title ? (
              <h2 id={titleId} className="text-base font-semibold text-foreground">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
