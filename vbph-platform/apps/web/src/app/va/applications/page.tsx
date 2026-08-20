import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, EmptyState } from "@vbph/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getVaApplications } from "@/server/queries/va/applications";
import { ApplicationStatusBadge } from "@/components/shared/application-status-badge";

export const metadata: Metadata = { title: "My Applications — Virtual Bridge PH" };

export default async function VaApplicationsPage() {
  const user = await requireRole("VA");
  const applications = await getVaApplications(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Applications</h1>
        <p className="text-sm text-muted-foreground">Track the jobs you&apos;ve applied to.</p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No applications yet"
            description="Once you apply to a job, you can track its status here."
            action={
              <Link
                href="/va/jobs"
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
              >
                Browse the Job Marketplace
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {applications.map((app) => (
            <Link key={app.id} href={`/va/jobs/${app.jobId}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-medium text-foreground">{app.jobTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Applied{" "}
                      {new Date(app.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={app.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
