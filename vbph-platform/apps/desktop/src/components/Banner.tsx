import type { ReactNode } from "react";

interface BannerProps {
  kind: "warning" | "info";
  children: ReactNode;
  onDismiss?: () => void;
}

export function Banner({ kind, children, onDismiss }: BannerProps) {
  return (
    <div className={`banner banner-${kind}`} role="status">
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="banner-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
