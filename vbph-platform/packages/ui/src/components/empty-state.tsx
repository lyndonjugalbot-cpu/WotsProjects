import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** A Button, Link, or any other affordance — rendered below the description. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The one consistent "nothing here yet" pattern for the whole app —
 * replaces the hand-rolled `<Card><CardContent>No X yet.</CardContent></Card>`
 * that used to be copy-pasted per page with slightly different wording
 * and no icon. Every empty state now has the same shape: an icon for a
 * quick visual read, a plain-language title, and an optional one-line
 * explanation of *why* it's empty or what to do next — never just "No
 * data."
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {Icon ? (
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
