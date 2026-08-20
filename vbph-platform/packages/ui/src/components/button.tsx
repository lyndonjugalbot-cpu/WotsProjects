import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-colors motion-safe:duration-150 motion-safe:active:scale-[0.98] " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/90",
        outline: "border border-input bg-card text-foreground shadow-xs hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-hover",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-11 px-6 text-[15px]",
        icon: "h-10 w-10 shrink-0 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner in place of the icon slot and disables the button, without changing its width. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner className="size-4" /> : null}
        <span className={cn(loading && "opacity-90")}>{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";
