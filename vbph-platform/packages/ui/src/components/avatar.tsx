import { cn } from "../lib/cn";

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** User avatar with an initials fallback — most VA/client profiles won't have a photo uploaded. */
export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const style = { width: size, height: size };

  if (src) {
    // Plain <img>, not next/image: avatar_url can point anywhere (Supabase
    // Storage, an external URL) and isn't known ahead of time, so it can't
    // go through next/image's remote-pattern allowlist without configuring
    // one per possible host.
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      style={{ ...style, fontSize: size * 0.4 }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground ring-1 ring-black/5",
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
