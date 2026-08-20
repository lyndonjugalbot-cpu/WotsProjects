import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getAdminJobDetail } from "@/server/queries/admin/jobs";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import { JobStatusForm } from "@/components/admin/job-status-form";
import { RateOverrideForm } from "@/components/admin/rate-override-form";
import { updateJobRatesAction } from "@/server/actions/admin-jobs";

export const metadata: Metadata = { title: "Job — Virtual Bridge PH" };

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getAdminJobDetail(jobId);
  if (!job) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Jobs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>{job.title}</CardTitle>
              <JobStatusBadge status={job.status} />
            </div>
            <Link href={`/admin/clients/${job.clientId}`} className="text-sm text-link hover:underline">
              {job.companyName}
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Applicants</dt>
              <dd className="font-medium text-foreground">
                <Link href="/admin/applications" className="text-link hover:underline">
                  {job.applicationCount}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">VAs Hired</dt>
              <dd className="font-medium text-foreground">
                {job.activePlacementCount} / {job.numVasRequired}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Hours/Week</dt>
              <dd className="font-medium text-foreground">{job.hoursPerWeek ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Posted</dt>
              <dd className="font-medium text-foreground">
                {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </dd>
            </div>
          </dl>
          {job.requiredSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <JobStatusForm jobId={job.id} status={job.status} />
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
            action={updateJobRatesAction.bind(null, job.id)}
            clientHourlyRate={job.clientHourlyRate}
            vaHourlyRate={job.vaHourlyRate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
