import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { JobForm } from "@/components/client/job-form";

export const metadata: Metadata = { title: "Post a Job — Virtual Bridge PH" };

export default async function NewJobPage() {
  await getClientContext();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/client/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to jobs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post a Job</CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
