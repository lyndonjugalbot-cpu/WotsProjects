import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getClientOptions } from "@/server/queries/admin/clients";
import { CreateUserForm } from "@/components/admin/create-user-form";

export const metadata: Metadata = { title: "New User — Virtual Bridge PH" };

export default async function NewUserPage() {
  const clients = await getClientOptions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New User</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
