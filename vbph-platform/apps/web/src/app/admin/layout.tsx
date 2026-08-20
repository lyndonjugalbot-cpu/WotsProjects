import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  FileText,
  Handshake,
  FolderKanban,
  Clock,
  ClipboardCheck,
  Receipt,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/admin/clients", icon: Building2 },
  { label: "VAs", href: "/admin/vas", icon: Users },
  { label: "Jobs", href: "/admin/jobs", icon: Briefcase },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Placements", href: "/admin/placements", icon: Handshake },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Time Tracking", href: "/admin/time", icon: Clock },
  { label: "Timesheets", href: "/admin/timesheets", icon: ClipboardCheck },
  { label: "Invoices", href: "/admin/invoices", icon: Receipt },
  { label: "Compensation", href: "/admin/compensation", icon: Wallet },
  // Payroll, reports — later phases.
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireRole("ADMIN");

  return (
    <DashboardShell navItems={NAV_ITEMS} portalLabel="Admin Portal" userLabel={fullName ?? "Admin"}>
      {children}
    </DashboardShell>
  );
}
