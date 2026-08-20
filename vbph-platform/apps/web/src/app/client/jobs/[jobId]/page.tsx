import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getClientJob } from "@/server/queries/client/jobs";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import { JobStatusActions } from "@/components/client/job-status-actions";
import { JobForm } from "@/components/client/job-form";

export const metadata: Metadata = { title: "Job — Virtual Bridge PH" };

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const LOCKED_STATUSES = ["FILLED", "CLOSED"];

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { clientId } = await getClientContext();
  const job = await getClientJob(clientId, jobId);

  if (!job) {
    notFound();
  }

  const locked = LOCKED_STATUSES.includes(job.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/client/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to jobs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>{job.title}</CardTitle>
              <JobStatusBadge status={job.status} />
            </div>
            <JobStatusActions jobId={job.id} status={job.status} />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Hourly Rate</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {currency(job.clientHourlyRate)}/hour
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">VAs Needed</dt>
              <dd className="font-medium text-foreground">{job.numVasRequired}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Applicants</dt>
              <dd className="font-medium text-foreground">
                {job.applicationCount > 0 ? (
                  <Link href={`/client/jobs/${job.id}/applicants`} className="text-link hover:underline">
                    {job.applicationCount}
                  </Link>
                ) : (
                  job.applicationCount
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Posted</dt>
              <dd className="font-medium text-foreground">
                {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{locked ? "Job Details" : "Edit Job"}</CardTitle>
        </CardHeader>
        <CardContent>
          {locked ? (
            <p className="text-sm text-muted-foreground">
              This job is {job.status.toLowerCase()} and can no longer be edited.
            </p>
          ) : (
            <JobForm mode="edit" job={job} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
