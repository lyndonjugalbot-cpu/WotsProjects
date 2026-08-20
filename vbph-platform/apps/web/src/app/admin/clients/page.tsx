import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge, Card, CardContent, EmptyState } from "@vbph/ui";
import { getAllClients } from "@/server/queries/admin/clients";

export const metadata: Metadata = { title: "Clients — Virtual Bridge PH" };

export default async function AdminClientsPage() {
  const clients = await getAllClients();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">{clients.length} companies on the platform.</p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="No clients yet" description="Client companies will show up here once they sign up." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/admin/clients/${client.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-medium text-foreground">{client.companyName}</p>
                    <p className="text-sm text-muted-foreground">{client.billingEmail ?? "No billing email"}</p>
                  </div>
                  <Badge variant={client.status === "active" ? "success" : "destructive"}>
                    {client.status === "active" ? "Active" : "Suspended"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
