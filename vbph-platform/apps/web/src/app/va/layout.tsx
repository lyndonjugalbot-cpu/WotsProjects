import { LayoutDashboard, Search, FileText, Clock, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/va/dashboard", icon: LayoutDashboard },
  { label: "Job Marketplace", href: "/va/jobs", icon: Search },
  { label: "My Applications", href: "/va/applications", icon: FileText },
  { label: "Work Diary", href: "/va/work-diary", icon: Clock },
  { label: "Compensation", href: "/va/compensation", icon: Wallet },
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
