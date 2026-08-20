import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getAdminPlacementDetail } from "@/server/queries/admin/placements";
import { PlacementStatusForm } from "@/components/admin/placement-status-form";
import { RateOverrideForm } from "@/components/admin/rate-override-form";
import { updatePlacementRatesAction } from "@/server/actions/admin-placements";

export const metadata: Metadata = { title: "Placement — Virtual Bridge PH" };

const STATUS_VARIANT: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  paused: "warning",
  ended: "default",
};

export default async function AdminPlacementDetailPage({
  params,
}: {
  params: Promise<{ placementId: string }>;
}) {
  const { placementId } = await params;
  const placement = await getAdminPlacementDetail(placementId);
  if (!placement) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/placements" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Placements
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>{placement.vaFullName}</CardTitle>
              <Badge variant={STATUS_VARIANT[placement.status] ?? "default"}>{placement.status}</Badge>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/clients/${placement.clientId}`} className="text-link hover:underline">
                {placement.companyName}
              </Link>
              <Link href={`/admin/vas/${placement.vaId}`} className="text-link hover:underline">
                VA Profile
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {placement.jobTitle ? (
              <div>
                <dt className="text-muted-foreground">Job</dt>
                <dd className="font-medium text-foreground">{placement.jobTitle}</dd>
              </div>
            ) : null}
            {placement.projectName ? (
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd className="font-medium text-foreground">{placement.projectName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Hours/Week</dt>
              <dd className="font-medium text-foreground">{placement.hoursPerWeekExpected ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Start Date</dt>
              <dd className="font-medium text-foreground">
                {new Date(placement.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <PlacementStatusForm placementId={placement.id} status={placement.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rates</CardTitle>
          <p className="text-xs text-muted-foreground">
            Client Rate, VA Rate, and VBPH Margin — visible only in the Admin Portal.
          </p>
        </CardHeader>
        <CardContent>
          <RateOverrideForm
            action={updatePlacementRatesAction.bind(null, placement.id)}
            clientHourlyRate={placement.clientHourlyRate}
            vaHourlyRate={placement.vaHourlyRate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
