import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@vbph/ui";
import { signOutAction } from "@/server/actions/auth";
import { DashboardNavLinks, MobileNav } from "./dashboard-nav";

export interface DashboardNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface DashboardShellProps {
  children: React.ReactNode;
  navItems: DashboardNavItem[];
  portalLabel: string;
  userLabel: string;
}

/**
 * Shared shell for all three portals. Each portal's layout.tsx supplies its
 * own nav items and role-checked children — this component has no opinion
 * about auth/roles, it's purely presentational. Stays a Server Component;
 * the only interactive pieces (active-link highlighting, the mobile
 * drawer) are isolated in dashboard-nav.tsx's two small Client Components
 * so the rest of the shell — and the page content it wraps — never has to
 * cross the client boundary just to render a sidebar.
 */
export function DashboardShell({ children, navItems, portalLabel, userLabel }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background sm:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card sm:flex sm:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            VB
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Virtual Bridge PH</span>
        </div>
        <div className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {portalLabel}
        </div>
        <DashboardNavLinks navItems={navItems} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
          <MobileNav navItems={navItems} portalLabel={portalLabel} />
          <span className="text-sm font-medium text-foreground sm:hidden">{portalLabel}</span>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar name={userLabel} size={30} />
              <span className="text-sm font-medium text-foreground">{userLabel}</span>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 focus:outline-none">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          <Link href="/" className="hover:text-foreground">
            Virtual Bridge PH
          </Link>
        </footer>
      </div>
    </div>
  );
}
