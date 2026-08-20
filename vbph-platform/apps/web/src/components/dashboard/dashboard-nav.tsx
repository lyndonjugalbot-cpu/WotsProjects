"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@vbph/ui";
import type { DashboardNavItem } from "./dashboard-shell";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A nav item is "active" for its own route and any sub-route beneath it, except the portal root, which would otherwise match everything. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary-soft-foreground"
                : "text-foreground/80 hover:bg-muted hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/** The sidebar's actual link list — shared between the always-visible desktop sidebar and the mobile drawer's contents. */
export function DashboardNavLinks({ navItems }: { navItems: DashboardNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
      <NavLinks navItems={navItems} pathname={pathname} />
    </nav>
  );
}

/**
 * Mobile-only: a hamburger trigger in the header plus a slide-in drawer
 * containing the same nav — previously the sidebar was simply `hidden`
 * below the `sm` breakpoint with no replacement at all, so a signed-in
 * user on a phone had no way to move between sections except editing the
 * URL by hand.
 */
export function MobileNav({ navItems, portalLabel }: { navItems: DashboardNavItem[]; portalLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const trigger = triggerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawer?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      (previouslyFocused ?? trigger)?.focus();
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="-ml-2 flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-neutral-900/50 motion-safe:animate-[fade-in_150ms_ease-out]"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-card shadow-lg motion-safe:animate-[drawer-in_180ms_ease-out]"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-medium text-muted-foreground">{portalLabel}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Primary">
              <NavLinks navItems={navItems} pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
