import { LayoutDashboard, Search, FileText, Clock, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";

const ICON_CLASS = "size-4 shrink-0";

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/va/dashboard", icon: <LayoutDashboard className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Job Marketplace", href: "/va/jobs", icon: <Search className={ICON_CLASS} aria-hidden="true" /> },
  { label: "My Applications", href: "/va/applications", icon: <FileText className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Work Diary", href: "/va/work-diary", icon: <Clock className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Compensation", href: "/va/compensation", icon: <Wallet className={ICON_CLASS} aria-hidden="true" /> },
  // Profile — later phases.
];

export default async function VaLayout({ children }: { children: React.ReactNode }) {
  // Approval-status branching (pending/rejected/suspended screens) arrives
  // in Phase 4. For now this only gates by role, same as the other portals.
  const { fullName } = await requireRole("VA");

  return (
    <DashboardShell navItems={NAV_ITEMS} portalLabel="VA Portal" userLabel={fullName ?? "VA"}>
      {children}
    </DashboardShell>
  );
}
