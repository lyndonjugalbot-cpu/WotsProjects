import { Badge, Card, CardContent } from "@vbph/ui";
import type { VaPlacementCard as VaPlacementCardData } from "@/server/queries/va/placements";

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_VARIANT: Record<string, "success" | "warning"> = {
  ACTIVE: "success",
  PAUSED: "warning",
};

export function VaPlacementCard({ placement }: { placement: VaPlacementCardData }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{placement.companyName}</p>
            {placement.jobTitle ? (
              <p className="text-sm text-muted-foreground">{placement.jobTitle}</p>
            ) : null}
          </div>
          <Badge variant={STATUS_VARIANT[placement.status] ?? "default"}>{placement.status}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {placement.projectName ? (
            <div>
              <dt className="text-muted-foreground">Project</dt>
              <dd className="truncate font-medium text-foreground">{placement.projectName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Your Rate</dt>
            <dd className="font-medium tabular-nums text-foreground">{currency(placement.vaHourlyRate)}/hr</dd>
          </div>
          {placement.hoursPerWeekExpected ? (
            <div>
              <dt className="text-muted-foreground">Weekly Hour Limit</dt>
              <dd className="font-medium text-foreground">{placement.hoursPerWeekExpected} hrs</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Start Date</dt>
            <dd className="font-medium text-foreground">
              {new Date(placement.startDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
