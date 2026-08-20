import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

// Every colored variant is a soft-tinted pill using a dedicated
// *-soft/-soft-foreground token pair (see tailwind-theme.css) — each
// individually verified at AA contrast for small badge-sized text. The
// obvious shortcut, `bg-x/10 text-x`, measured well under 4.5:1 for both
// the orange and teal brand hues at this size; these pairs replace it.
const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full font-medium", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      primary: "bg-primary-soft text-primary-soft-foreground",
      secondary: "bg-secondary-soft text-secondary-soft-foreground",
      success: "bg-success-soft text-success-soft-foreground",
      warning: "bg-warning-soft text-warning-soft-foreground",
      destructive: "bg-destructive-soft text-destructive-soft-foreground",
      info: "bg-info-soft text-info-soft-foreground",
    },
    size: {
      sm: "px-2 py-0.5 text-[11px]",
      md: "px-2.5 py-0.5 text-xs",
    },
  },
  defaultVariants: { variant: "default", size: "md" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Renders a small solid dot before the label — for status lists where color alone shouldn't have to carry the meaning. */
  dot?: boolean;
}

const DOT_COLOR_BY_VARIANT: Record<string, string> = {
  default: "bg-muted-foreground",
  primary: "bg-primary-hover",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
};

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", DOT_COLOR_BY_VARIANT[variant ?? "default"])}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
