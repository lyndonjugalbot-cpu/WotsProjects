import { cn } from "../lib/cn";

export interface SpinnerProps {
  className?: string;
  /**
   * Visually-hidden text for screen readers, only rendered if provided.
   * Omit this when the spinner sits inside a control that already has its
   * own accessible name/state (e.g. a Button with visible "Saving…" text
   * and aria-busy) — a second hidden announcement there is noise, not help.
   * Pass one for a standalone spinner with no surrounding text of its own.
   */
  label?: string;
}

/** A small, original loading indicator — a simple rotating arc, not a copied icon set's spinner glyph. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={cn("size-5 motion-safe:animate-spin", className)}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
