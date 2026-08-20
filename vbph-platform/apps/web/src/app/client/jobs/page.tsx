import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, Briefcase } from "lucide-react";
import { Card, CardContent, EmptyState } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getClientJobs } from "@/server/queries/client/jobs";
import { JobStatusBadge } from "@/components/shared/job-status-badge";

export const metadata: Metadata = { title: "Jobs — Virtual Bridge PH" };

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function ClientJobsPage() {
  const { clientId } = await getClientContext();
  const jobs = await getClientJobs(clientId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">Post a role and find your next VA.</p>
        </div>
        <Link
          href="/client/jobs/new"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
        >
          <PlusCircle className="size-4" aria-hidden="true" />
          Post a Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="No jobs posted yet"
            description="Post one to start finding VAs."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/client/jobs/${job.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{job.title}</span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currency(job.clientHourlyRate)}/hr
                      {job.hoursPerWeek ? ` · ${job.hoursPerWeek} hrs/week` : ""}
                      {job.numVasRequired > 1 ? ` · ${job.numVasRequired} VAs needed` : ""}
                    </p>
                  </div>
                  {job.applicationDeadline ? (
                    <p className="text-xs text-muted-foreground">
                      Apply by{" "}
                      {new Date(job.applicationDeadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
