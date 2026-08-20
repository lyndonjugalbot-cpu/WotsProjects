import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Applies to the wrapper (the positioning context for the chevron), not the <select> itself — width utilities like `w-56`/`w-auto` belong here, and this keeps the icon aligned with whatever width results. */
  className?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("relative w-full", className)}>
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full appearance-none rounded-md border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground shadow-xs",
          "transition-colors motion-safe:duration-150",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive"
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
);
Select.displayName = "Select";
