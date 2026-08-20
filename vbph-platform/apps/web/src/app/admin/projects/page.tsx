import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, FolderKanban } from "lucide-react";
import { Badge, Card, CardContent, EmptyState } from "@vbph/ui";
import { getAllProjects } from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Projects — Virtual Bridge PH" };

const STATUS_VARIANT: Record<string, "success" | "warning" | "default" | "destructive"> = {
  active: "success",
  paused: "warning",
  completed: "default",
  cancelled: "destructive",
};

export default async function AdminProjectsPage() {
  const projects = await getAllProjects();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projects across all clients.</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
        >
          <PlusCircle className="size-4" aria-hidden="true" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState icon={FolderKanban} title="No projects yet" description="Create one to start organizing placements." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium text-foreground">{project.name}</p>
                  <Link href={`/admin/clients/${project.clientId}`} className="text-sm text-link hover:underline">
                    {project.companyName}
                  </Link>
                </div>
                <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>{project.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
