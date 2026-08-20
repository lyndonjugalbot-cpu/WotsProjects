import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Card, CardContent, EmptyState } from "@vbph/ui";
import { getAllJobs } from "@/server/queries/admin/jobs";
import { JobStatusBadge } from "@/components/shared/job-status-badge";

export const metadata: Metadata = { title: "Jobs — Virtual Bridge PH" };

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function AdminJobsPage() {
  const jobs = await getAllJobs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">{jobs.length} job postings across all clients.</p>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <EmptyState icon={Briefcase} title="No jobs yet" description="Job postings from clients will show up here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/admin/jobs/${job.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{job.title}</span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {job.companyName} · {job.applicationCount} applicant{job.applicationCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Client {currency(job.clientHourlyRate)}/hr</p>
                    <p>VA {currency(job.vaHourlyRate)}/hr</p>
                    <p>Margin {currency(job.agencyMargin)}/hr</p>
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
