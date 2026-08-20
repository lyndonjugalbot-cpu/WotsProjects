import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getAdminClientDetail } from "@/server/queries/admin/clients";
import { ClientProfileForm } from "@/components/admin/client-profile-form";
import { ClientStatusToggle } from "@/components/admin/client-status-toggle";

export const metadata: Metadata = { title: "Client — Virtual Bridge PH" };

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getAdminClientDetail(clientId);
  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Clients
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{client.companyName}</CardTitle>
            <ClientStatusToggle clientId={client.id} status={client.status} />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Jobs</dt>
              <dd className="font-medium text-foreground">{client.jobCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Placements</dt>
              <dd className="font-medium text-foreground">{client.placementCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Projects</dt>
              <dd className="font-medium text-foreground">{client.projectCount}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientProfileForm client={client} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {client.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {client.members.map((member) => (
                <li key={member.profileId} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-foreground">{member.fullName}</span>{" "}
                    <span className="text-muted-foreground">({member.roleInCompany})</span>
                  </div>
                  <Badge variant={member.status === "active" ? "success" : "destructive"}>
                    {member.status === "active" ? "Active" : "Suspended"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
