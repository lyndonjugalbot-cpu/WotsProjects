import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card, CardContent, EmptyState } from "@vbph/ui";
import { getAllApplications } from "@/server/queries/admin/applications";
import { ApplicationStatusBadge } from "@/components/shared/application-status-badge";

export const metadata: Metadata = { title: "Applications — Virtual Bridge PH" };

export default async function AdminApplicationsPage() {
  const applications = await getAllApplications();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Applications</h1>
        <p className="text-sm text-muted-foreground">All job applications across the platform.</p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No applications yet" description="Applications from VAs will show up here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {applications.map((app) => (
            <Link key={app.id} href={`/admin/applications/${app.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-medium text-foreground">{app.vaFullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.jobTitle} · {app.companyName}
                    </p>
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
