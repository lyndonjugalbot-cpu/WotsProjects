import * as React from "react";
import { cn } from "../lib/cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs",
        "transition-colors motion-safe:duration-150",
        "placeholder:text-muted-foreground",
        "hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
