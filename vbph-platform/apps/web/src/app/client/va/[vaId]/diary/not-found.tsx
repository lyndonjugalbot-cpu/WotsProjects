import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";

export default function DiaryNotFound() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Work diary not found</CardTitle>
        <CardDescription>
          This VA isn&apos;t currently on your team, or the link is incorrect.
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
