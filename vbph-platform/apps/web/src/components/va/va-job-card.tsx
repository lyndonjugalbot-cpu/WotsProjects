import Link from "next/link";
import { Badge, Card, CardContent } from "@vbph/ui";
import type { VaJobListItem } from "@/server/queries/va/jobs";

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const EXPERIENCE_LABEL: Record<string, string> = {
  ENTRY: "Entry-level",
  INTERMEDIATE: "Intermediate",
  EXPERT: "Expert",
};

export function VaJobCard({ job }: { job: VaJobListItem }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium text-foreground">{job.title}</h3>
            {job.descriptionPreview ? (
              <p className="mt-1 text-sm text-muted-foreground">{job.descriptionPreview}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {currency(job.vaHourlyRate)}
            </p>
            <p className="text-xs text-muted-foreground">/hour</p>
          </div>
        </div>

        {job.requiredSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {job.requiredSkills.map((skill) => (
              <Badge key={skill} variant="default">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          {job.hoursPerWeek ? <div>{job.hoursPerWeek} hrs/week</div> : null}
          {job.schedule ? <div>{job.schedule}</div> : null}
          {job.timezone ? <div>{job.timezone}</div> : null}
          {job.experienceLevel ? <div>{EXPERIENCE_LABEL[job.experienceLevel] ?? job.experienceLevel}</div> : null}
          {job.numVasRequired > 1 ? <div>{job.numVasRequired} VAs needed</div> : null}
        </dl>

        <div className="pt-1">
          <Link
            href={`/va/jobs/${job.id}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
          >
            View Job
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
