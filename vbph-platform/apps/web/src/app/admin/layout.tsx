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

const ICON_CLASS = "size-4 shrink-0";

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Clients", href: "/admin/clients", icon: <Building2 className={ICON_CLASS} aria-hidden="true" /> },
  { label: "VAs", href: "/admin/vas", icon: <Users className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Jobs", href: "/admin/jobs", icon: <Briefcase className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Applications", href: "/admin/applications", icon: <FileText className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Placements", href: "/admin/placements", icon: <Handshake className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Projects", href: "/admin/projects", icon: <FolderKanban className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Time Tracking", href: "/admin/time", icon: <Clock className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Timesheets", href: "/admin/timesheets", icon: <ClipboardCheck className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Invoices", href: "/admin/invoices", icon: <Receipt className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Compensation", href: "/admin/compensation", icon: <Wallet className={ICON_CLASS} aria-hidden="true" /> },
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
