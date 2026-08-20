import { LayoutDashboard, Briefcase, ClipboardCheck, Receipt } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";

const ICON_CLASS = "size-4 shrink-0";

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/client/dashboard", icon: <LayoutDashboard className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Jobs", href: "/client/jobs", icon: <Briefcase className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Timesheets", href: "/client/timesheets", icon: <ClipboardCheck className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Invoices", href: "/client/invoices", icon: <Receipt className={ICON_CLASS} aria-hidden="true" /> },
  // Company profile, VAs, projects — Phase 5+.
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireRole("CLIENT");

  return (
    <DashboardShell navItems={NAV_ITEMS} portalLabel="Client Portal" userLabel={fullName ?? "Client"}>
      {children}
    </DashboardShell>
  );
}
