import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar, Badge, Card, CardContent, EmptyState } from "@vbph/ui";
import { getAllVAs } from "@/server/queries/admin/vas";

export const metadata: Metadata = { title: "VAs — Virtual Bridge PH" };

const APPROVAL_VARIANT: Record<string, "success" | "warning" | "destructive" | "default"> = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
  suspended: "destructive",
};

export default async function AdminVAsPage() {
  const vas = await getAllVAs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Virtual Assistants</h1>
        <p className="mt-1 text-sm text-muted-foreground">{vas.length} VAs on the platform.</p>
      </div>

      {vas.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No VAs yet" description="VA profiles will show up here once they sign up." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {vas.map((va) => (
            <Link key={va.id} href={`/admin/vas/${va.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar src={va.avatarUrl} name={va.fullName} size={40} />
                    <div>
                      <p className="font-medium text-foreground">{va.fullName}</p>
                      <p className="text-sm text-muted-foreground">{va.headline ?? "No headline"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {va.accountStatus !== "active" ? <Badge variant="destructive">Suspended</Badge> : null}
                    <Badge variant={APPROVAL_VARIANT[va.approvalStatus] ?? "default"}>{va.approvalStatus}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
