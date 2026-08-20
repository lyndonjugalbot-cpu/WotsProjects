import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, type BadgeProps } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getProjectDetail } from "@/server/queries/client/project";

export const metadata: Metadata = { title: "Project — Virtual Bridge PH" };

const STATUS_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  active: "success",
  paused: "warning",
  ended: "default",
  completed: "success",
  cancelled: "destructive",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { clientId } = await getClientContext();
  const project = await getProjectDetail(clientId, projectId);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/client/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{project.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Started {new Date(project.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>{project.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            {project.description ?? "No description added yet."}
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Team on this project</h2>
        {project.members.length === 0 ? (
          <Card>
            <EmptyState icon={Users} title="No VAs assigned yet" description="Assign a placement to this project to see them here." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.members.map((member) => (
              <Card key={member.vaId}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar name={member.fullName} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{member.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.headline ?? "No position set"}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[member.status] ?? "default"}>{member.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
