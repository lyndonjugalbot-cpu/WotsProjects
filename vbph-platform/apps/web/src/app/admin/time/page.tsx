import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { Card, EmptyState } from "@vbph/ui";
import { getAdminWorkDiary } from "@/server/queries/admin/work-diary";
import { getDiaryDateRange, todayIsoDate, type DiaryView } from "@/lib/work-diary-date-range";
import { DiaryNav } from "@/components/shared/work-diary/diary-nav";
import { DiarySummaryStats } from "@/components/shared/work-diary/diary-summary";
import { DiaryBlockCard } from "@/components/shared/work-diary/diary-block-card";
import { adminDeleteSegmentAction } from "@/server/actions/work-diary";

export const metadata: Metadata = { title: "Time Tracking — Virtual Bridge PH" };

export default async function AdminTimePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const query = await searchParams;
  const view: DiaryView = query.view === "week" ? "week" : "day";
  const anchor = query.date ?? todayIsoDate();
  const { startDate, endDate } = getDiaryDateRange(view, anchor);

  const { blocks, summary } = await getAdminWorkDiary(startDate, endDate);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Time Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Every tracked block across the platform for the selected range.
        </p>
      </div>

      <DiaryNav view={view} anchor={anchor} />
      <DiarySummaryStats summary={summary} />

      {blocks.length === 0 ? (
        <Card>
          <EmptyState icon={Clock} title="No tracked time in this range" description="Try a different day or week." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {blocks.map((block) => (
            <DiaryBlockCard
              key={block.segmentId}
              block={block}
              canDelete
              deleteAction={adminDeleteSegmentAction}
              confirmMessage="Deleting this screenshot will remove this time segment from tracked hours. This action is recorded in the audit log."
              showVaContext
            />
          ))}
        </div>
      )}
    </div>
  );
}
