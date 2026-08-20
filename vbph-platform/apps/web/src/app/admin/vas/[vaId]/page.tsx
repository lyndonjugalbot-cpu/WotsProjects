import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getAdminVaDetail } from "@/server/queries/admin/vas";
import { VaProfileForm } from "@/components/admin/va-profile-form";
import { VaApprovalForm } from "@/components/admin/va-approval-form";
import { VaStatusToggle } from "@/components/admin/va-status-toggle";

export const metadata: Metadata = { title: "VA — Virtual Bridge PH" };

export default async function AdminVaDetailPage({
  params,
}: {
  params: Promise<{ vaId: string }>;
}) {
  const { vaId } = await params;
  const va = await getAdminVaDetail(vaId);
  if (!va) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/vas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to VAs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar src={va.avatarUrl} name={va.fullName} size={48} />
              <div>
                <CardTitle>{va.fullName}</CardTitle>
                {va.headline ? <p className="text-sm text-muted-foreground">{va.headline}</p> : null}
              </div>
            </div>
            <VaStatusToggle vaId={va.id} status={va.accountStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Active Placements</dt>
              <dd className="font-medium text-foreground">{va.activePlacementCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Experience</dt>
              <dd className="font-medium text-foreground">
                {va.experienceYears != null ? `${va.experienceYears} yrs` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Timezone</dt>
              <dd className="font-medium text-foreground">{va.timezone ?? "—"}</dd>
            </div>
          </dl>
          {va.skills.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {va.skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <VaApprovalForm va={va} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <VaProfileForm va={va} />
        </CardContent>
      </Card>
    </div>
  );
}
