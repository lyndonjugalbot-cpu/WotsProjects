import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Card, EmptyState } from "@vbph/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getVaPlacements } from "@/server/queries/va/placements";
import { VaPlacementCard } from "@/components/va/va-placement-card";

export const metadata: Metadata = { title: "Dashboard — Virtual Bridge PH" };

export default async function VaDashboardPage() {
  const user = await requireRole("VA");
  const placements = await getVaPlacements(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back{user.fullName ? `, ${user.fullName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what you&apos;re currently placed on.</p>
      </div>

      {placements.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Not currently placed"
            description="Once a placement is activated, it'll show up here."
            action={
              <Link
                href="/va/jobs"
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
              >
                Browse the Job Marketplace
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placements.map((placement) => (
            <VaPlacementCard key={placement.id} placement={placement} />
          ))}
        </div>
      )}
    </div>
  );
}
