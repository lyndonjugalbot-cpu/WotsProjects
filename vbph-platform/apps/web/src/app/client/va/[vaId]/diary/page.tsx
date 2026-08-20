import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { Badge, Card, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, type BadgeProps } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getWorkDiary } from "@/server/queries/client/work-diary";

export const metadata: Metadata = { title: "Work Diary — Virtual Bridge PH" };

const STATUS_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
};

export default async function WorkDiaryPage({ params }: { params: Promise<{ vaId: string }> }) {
  const { vaId } = await params;
  const { clientId } = await getClientContext();
  const diary = await getWorkDiary(clientId, vaId);

  if (!diary) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/client/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{diary.fullName}&apos;s Work Diary</h1>
        <p className="mt-1 text-sm text-muted-foreground">{diary.headline ?? "No position set"}</p>
      </div>

      {diary.entries.length === 0 ? (
        <Card>
          <EmptyState icon={History} title="No tracked sessions yet" description="Sessions appear here once this VA starts tracking time." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Recent sessions</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Screenshots</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diary.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-foreground">
                    {new Date(entry.startedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(entry.startedAt).toLocaleTimeString("en-US", { timeStyle: "short" })}
                    {" – "}
                    {entry.endedAt
                      ? new Date(entry.endedAt).toLocaleTimeString("en-US", { timeStyle: "short" })
                      : "in progress"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{entry.totalHours.toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{entry.screenshotCount}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[entry.status] ?? "default"}>{entry.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
