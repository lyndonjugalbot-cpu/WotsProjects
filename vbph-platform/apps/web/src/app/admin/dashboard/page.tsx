import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { UserPlus, Building2, Users, Briefcase, ClipboardCheck, Handshake, Clock, Receipt, Wallet, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@vbph/ui";
import { getAdminDashboardStats } from "@/server/queries/admin/dashboard";

export const metadata: Metadata = { title: "Dashboard — Virtual Bridge PH" };

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Platform-wide overview.</p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          New User
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Platform Activity</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Active Clients" value={String(stats.activeClients)} icon={Building2} />
          <Stat label="Active VAs" value={String(stats.activeVas)} icon={Users} />
          <Stat label="Open Jobs" value={String(stats.openJobs)} icon={Briefcase} />
          <Stat label="Pending Applications" value={String(stats.pendingApplications)} icon={ClipboardCheck} />
          <Stat label="Active Placements" value={String(stats.activePlacements)} icon={Handshake} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">This Week — Financials</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Client Rate, VA Rate, and VBPH Margin figures are visible only in the Admin Portal.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Hours Tracked" value={stats.hoursTrackedThisWeek.toFixed(1)} icon={Clock} />
          <Stat label="Client Billings" value={currency(stats.clientBillingsThisWeek)} icon={Receipt} />
          <Stat label="VA Payroll Estimate" value={currency(stats.vaPayrollEstimateThisWeek)} icon={Wallet} />
          <Stat
            label="Agency Gross Margin"
            value={currency(stats.agencyGrossMarginThisWeek)}
            icon={TrendingUp}
            emphasize
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize,
  icon: Icon,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              // text-primary-hover (the deep orange), not text-primary — the
              // raw brand orange measures under 3:1 against white even at
              // this size, still short of AA's large-text minimum.
              emphasize ? "text-primary-hover" : "text-foreground"
            }`}
          >
            {value}
          </p>
        </div>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            emphasize ? "bg-success-soft text-success-soft-foreground" : "bg-primary-soft text-primary-soft-foreground"
          }`}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
