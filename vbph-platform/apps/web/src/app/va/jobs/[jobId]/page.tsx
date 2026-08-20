import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { WITHDRAWABLE_APPLICATION_STATUSES } from "@vbph/schemas";
import { getVaApprovalStatus } from "@/server/queries/va/context";
import { getVaJob } from "@/server/queries/va/jobs";
import { ApplyJobForm, WithdrawApplicationForm } from "@/components/va/apply-job-form";
import { ApplicationStatusBadge } from "@/components/shared/application-status-badge";

export const metadata: Metadata = { title: "Job — Virtual Bridge PH" };

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const EXPERIENCE_LABEL: Record<string, string> = {
  ENTRY: "Entry-level",
  INTERMEDIATE: "Intermediate",
  EXPERT: "Expert",
};

export default async function VaJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const approvalStatus = await getVaApprovalStatus();

  if (approvalStatus !== "approved") {
    notFound();
  }

  const job = await getVaJob(jobId);
  if (!job) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/va/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Job Marketplace
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <CardTitle>{job.title}</CardTitle>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {currency(job.vaHourlyRate)}
              </p>
              <p className="text-xs text-muted-foreground">/hour</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {job.hoursPerWeek ? (
              <div>
                <dt className="text-muted-foreground">Hours/Week</dt>
                <dd className="font-medium text-foreground">{job.hoursPerWeek}</dd>
              </div>
            ) : null}
            {job.schedule ? (
              <div>
                <dt className="text-muted-foreground">Schedule</dt>
                <dd className="font-medium text-foreground">{job.schedule}</dd>
              </div>
            ) : null}
            {job.timezone ? (
              <div>
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-medium text-foreground">{job.timezone}</dd>
              </div>
            ) : null}
            {job.experienceLevel ? (
              <div>
                <dt className="text-muted-foreground">Experience</dt>
                <dd className="font-medium text-foreground">
                  {EXPERIENCE_LABEL[job.experienceLevel] ?? job.experienceLevel}
                </dd>
              </div>
            ) : null}
            {job.numVasRequired > 1 ? (
              <div>
                <dt className="text-muted-foreground">VAs Needed</dt>
                <dd className="font-medium text-foreground">{job.numVasRequired}</dd>
              </div>
            ) : null}
            {job.applicationDeadline ? (
              <div>
                <dt className="text-muted-foreground">Apply By</dt>
                <dd className="font-medium text-foreground">
                  {new Date(job.applicationDeadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
            ) : null}
          </dl>

          {job.requiredSkills.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-foreground">Required Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </div>
          ) : null}

          {job.description ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-foreground">Description</h3>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{job.description}</p>
            </div>
          ) : null}

          {job.responsibilities ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-foreground">Responsibilities</h3>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{job.responsibilities}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {job.hasApplied ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm text-foreground">
                You applied to this job.
                {job.applicationStatus ? <ApplicationStatusBadge status={job.applicationStatus} /> : null}
              </p>
              {job.applicationStatus && WITHDRAWABLE_APPLICATION_STATUSES.includes(job.applicationStatus) ? (
                <WithdrawApplicationForm jobId={job.id} />
              ) : null}
            </div>
          ) : job.status === "OPEN" ? (
            <ApplyJobForm jobId={job.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This job is no longer accepting applications.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
