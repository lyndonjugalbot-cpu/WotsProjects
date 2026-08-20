import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Shared table primitives — replaces nine separate hand-rolled `<table>`
 * blocks that had each converged on nearly the same markup anyway
 * (muted uppercase header, divided rows, a horizontal-scroll wrapper)
 * with small, easy-to-miss inconsistencies between them. One definition
 * now, so a future change to row density or header styling is a single
 * edit instead of nine.
 *
 * The wrapper's `overflow-x-auto` is what keeps a wide table from ever
 * forcing the page itself to scroll sideways on a narrow screen — the
 * table scrolls within its own box instead.
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("border-t border-border bg-muted/40 font-medium text-foreground", className)} {...props} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Row itself is a clickable target (e.g. drill-down into a detail page) — adds a hover affordance beyond the default row hover. */
  clickable?: boolean;
}

export function TableRow({ className, clickable, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/40",
        clickable && "cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-11 px-4 text-left align-middle font-medium first:pl-4 last:pr-4", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle first:pl-4 last:pr-4", className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn("mt-3 text-xs text-muted-foreground", className)} {...props} />;
}
