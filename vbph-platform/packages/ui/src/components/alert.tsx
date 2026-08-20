import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, Info, TriangleAlert, CircleX, X } from "lucide-react";
import { cn } from "../lib/cn";

const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-info/20 bg-info-soft text-info-soft-foreground",
      success: "border-success/20 bg-success-soft text-success-soft-foreground",
      warning: "border-warning/30 bg-warning-soft text-warning-soft-foreground",
      destructive: "border-destructive/20 bg-destructive-soft text-destructive-soft-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICON_BY_VARIANT = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: CircleX,
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  onDismiss?: () => void;
}

/**
 * A page/section-level banner — for a standing condition worth the user's
 * attention (an offline state, a stale-session recovery notice, a
 * multi-field submission error) as distinct from a single field's own
 * inline validation message (see FieldMessage). Role is "alert" only for
 * destructive/warning — an "info"/"success" banner isn't urgent enough to
 * interrupt a screen reader's current reading position the way
 * role="alert" does.
 */
export function Alert({ className, variant = "info", title, onDismiss, children, ...props }: AlertProps) {
  const Icon = ICON_BY_VARIANT[variant ?? "info"];
  return (
    <div
      role={variant === "destructive" || variant === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "text-[13px] opacity-90")}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 h-fit shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
