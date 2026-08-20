import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getClientOptions } from "@/server/queries/admin/clients";
import { CreateProjectForm } from "@/components/admin/create-project-form";

export const metadata: Metadata = { title: "New Project — Virtual Bridge PH" };

export default async function NewProjectPage() {
  const clients = await getClientOptions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Projects
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateProjectForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
