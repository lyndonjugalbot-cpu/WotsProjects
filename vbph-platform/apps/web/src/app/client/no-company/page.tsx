import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Account setup — Virtual Bridge PH" };

// Reached when a CLIENT-role profile exists but no client_members row links
// it to a company yet — a real state (self-signup only creates the
// profile; an admin links it to a company), not an error.
export default async function NoCompanyPage() {
  await requireRole("CLIENT");

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Your account isn&apos;t linked to a company yet</CardTitle>
        <CardDescription>
          We couldn&apos;t find a company associated with your account. This usually means setup
          is still in progress on our end.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Reach out to your Virtual Bridge PH contact and we&apos;ll get this connected — you&apos;ll
          see your dashboard as soon as it is.
        </p>
      </CardContent>
    </Card>
  );
}
