import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { Card, EmptyState } from "@vbph/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getVaWorkDiary } from "@/server/queries/va/work-diary";
import { getDiaryDateRange, todayIsoDate, type DiaryView } from "@/lib/work-diary-date-range";
import { DiaryNav } from "@/components/shared/work-diary/diary-nav";
import { DiarySummaryStats } from "@/components/shared/work-diary/diary-summary";
import { DiaryBlockCard } from "@/components/shared/work-diary/diary-block-card";
import { deleteOwnScreenshotAction } from "@/server/actions/work-diary";

export const metadata: Metadata = { title: "Work Diary — Virtual Bridge PH" };

export default async function VaWorkDiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  await requireRole("VA");
  const params = await searchParams;
  const view: DiaryView = params.view === "week" ? "week" : "day";
  const anchor = params.date ?? todayIsoDate();
  const { startDate, endDate } = getDiaryDateRange(view, anchor);

  const { blocks, summary } = await getVaWorkDiary(startDate, endDate);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Work Diary</h1>
        <p className="text-sm text-muted-foreground">Your tracked time, screenshot by screenshot.</p>
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
              deleteAction={deleteOwnScreenshotAction}
              confirmMessage="Deleting this screenshot will also remove this time segment from your tracked hours."
            />
          ))}
        </div>
      )}
    </div>
  );
}
