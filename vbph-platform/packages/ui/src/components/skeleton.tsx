import { cn } from "../lib/cn";

/**
 * A loading placeholder. Kept intentionally dumb (one div, one animation) —
 * compose it into whatever shape a specific loading.tsx needs (a line of
 * text, a stat card, an avatar circle) rather than trying to anticipate
 * every shape here. `aria-hidden` because the real accessible loading
 * signal is the page's own `aria-busy`/route-level Suspense boundary, not
 * this individual placeholder.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
