import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";

export default function ProjectNotFound() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Project not found</CardTitle>
        <CardDescription>
          This project doesn&apos;t exist, or isn&apos;t associated with your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/client/dashboard" className="text-sm font-medium text-link hover:underline">
          ← Back to dashboard
        </Link>
      </CardContent>
    </Card>
  );
}
