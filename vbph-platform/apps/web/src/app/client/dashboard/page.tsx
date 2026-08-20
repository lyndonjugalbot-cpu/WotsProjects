import type { Metadata } from "next";
import { Users, FolderKanban, Clock, Receipt, ClipboardCheck, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getDashboardStats } from "@/server/queries/client/dashboard";
import { getTeamMembers } from "@/server/queries/client/team";
import { StatCard } from "@/components/client/stat-card";
import { TeamMemberCard } from "@/components/client/team-member-card";

export const metadata: Metadata = { title: "Dashboard — Virtual Bridge PH" };

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function ClientDashboardPage() {
  const { clientId, companyName } = await getClientContext();
  const [stats, team] = await Promise.all([
    getDashboardStats(clientId),
    getTeamMembers(clientId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{companyName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your team.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Active VAs" value={String(stats.activeVaCount)} icon={Users} />
        <StatCard label="Active Projects" value={String(stats.activeProjectCount)} icon={FolderKanban} />
        <StatCard
          label="Hours Tracked This Week"
          value={stats.hoursTrackedThisWeek.toFixed(1)}
          icon={Clock}
        />
        <StatCard
          label="Est. Weekly Invoice"
          value={currency(stats.estimatedWeeklyInvoice)}
          hint="Based on hours tracked so far this week"
          icon={Receipt}
        />
        <StatCard
          label="Outstanding Invoices"
          value={String(stats.outstandingInvoiceCount)}
          hint={stats.outstandingInvoiceCount > 0 ? currency(stats.outstandingInvoiceTotal) : undefined}
          icon={ClipboardCheck}
        />
        <StatCard label="Open Jobs" value={String(stats.openJobsCount)} icon={Briefcase} />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {stats.recentActivity.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-foreground">{item.description}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">My Team</h2>
        {team.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Once a placement is made, your VAs will show up here."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <TeamMemberCard key={member.placementId} member={member} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
