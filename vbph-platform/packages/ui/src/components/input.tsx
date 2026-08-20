import * as React from "react";
import { cn } from "../lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs",
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
Input.displayName = "Input";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
);
Label.displayName = "Label";

/** Small helper/error text for a form field — pass `error` to switch it to the destructive color and mark it as an error for assistive tech. Associate with the field via `id` + the field's `aria-describedby`. */
export const FieldMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <p
    ref={ref}
    role={error ? "alert" : undefined}
    className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground", className)}
    {...props}
  />
));
FieldMessage.displayName = "FieldMessage";
