import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { Card, EmptyState } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getProjectWorkDiary } from "@/server/queries/client/work-diary";
import { getDiaryDateRange, todayIsoDate, type DiaryView } from "@/lib/work-diary-date-range";
import { DiaryNav } from "@/components/shared/work-diary/diary-nav";
import { DiarySummaryStats } from "@/components/shared/work-diary/diary-summary";
import { DiaryBlockCard } from "@/components/shared/work-diary/diary-block-card";

export const metadata: Metadata = { title: "Work Diary — Virtual Bridge PH" };

export default async function ProjectWorkDiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { projectId } = await params;
  const { clientId } = await getClientContext();
  const query = await searchParams;
  const view: DiaryView = query.view === "week" ? "week" : "day";
  const anchor = query.date ?? todayIsoDate();
  const { startDate, endDate } = getDiaryDateRange(view, anchor);

  const diary = await getProjectWorkDiary(clientId, projectId, startDate, endDate);
  if (!diary) {
    notFound();
  }

  const { blocks, summary } = diary.result;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/client/projects/${projectId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to {diary.projectName}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">{diary.projectName} — Work Diary</h1>
        <p className="text-sm text-muted-foreground">
          Tracked time for every VA on this project. Screenshots and time are read-only here.
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
              canDelete={false}
              confirmMessage=""
              showVaContext
            />
          ))}
        </div>
      )}
    </div>
  );
}
