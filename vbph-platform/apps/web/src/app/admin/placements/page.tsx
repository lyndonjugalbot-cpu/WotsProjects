import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, Handshake } from "lucide-react";
import { Badge, Card, CardContent, EmptyState } from "@vbph/ui";
import { getAllPlacements } from "@/server/queries/admin/placements";

export const metadata: Metadata = { title: "Placements — Virtual Bridge PH" };

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_VARIANT: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  paused: "warning",
  ended: "default",
};

export default async function AdminPlacementsPage() {
  const placements = await getAllPlacements();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Placements</h1>
          <p className="text-sm text-muted-foreground">{placements.length} placements across all clients.</p>
        </div>
        <Link
          href="/admin/placements/new"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
        >
          <PlusCircle className="size-4" aria-hidden="true" />
          New Placement
        </Link>
      </div>

      {placements.length === 0 ? (
        <Card>
          <EmptyState icon={Handshake} title="No placements yet" description="Create one once an application has been marked HIRED." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {placements.map((placement) => (
            <Link key={placement.id} href={`/admin/placements/${placement.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{placement.vaFullName}</span>
                      <Badge variant={STATUS_VARIANT[placement.status] ?? "default"}>{placement.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {placement.companyName}
                      {placement.jobTitle ? ` · ${placement.jobTitle}` : ""}
                      {placement.projectName ? ` · ${placement.projectName}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Client {currency(placement.clientHourlyRate)}/hr</p>
                    <p>VA {currency(placement.vaHourlyRate)}/hr</p>
                    <p>Margin {currency(placement.agencyMargin)}/hr</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
