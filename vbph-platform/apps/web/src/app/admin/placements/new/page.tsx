import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getClientOptions } from "@/server/queries/admin/clients";
import { getApprovedVaOptions } from "@/server/queries/admin/vas";
import { getJobOptions } from "@/server/queries/admin/jobs";
import { getProjectOptions } from "@/server/queries/admin/projects";
import { CreatePlacementForm } from "@/components/admin/create-placement-form";

export const metadata: Metadata = { title: "New Placement — Virtual Bridge PH" };

export default async function NewPlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; vaId?: string; jobId?: string }>;
}) {
  const [{ clientId, vaId, jobId }, clients, vas, jobs, projects] = await Promise.all([
    searchParams,
    getClientOptions(),
    getApprovedVaOptions(),
    getJobOptions(),
    getProjectOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/placements" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Placements
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Placement</CardTitle>
          <p className="text-xs text-muted-foreground">
            Client Rate, VA Rate, and VBPH Margin — visible only in the Admin Portal.
          </p>
        </CardHeader>
        <CardContent>
          <CreatePlacementForm
            clients={clients}
            vas={vas}
            jobs={jobs}
            projects={projects}
            defaultClientId={clientId}
            defaultVaId={vaId}
            defaultJobId={jobId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
