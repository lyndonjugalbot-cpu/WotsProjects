"use client";

import { useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client dashboard failed to load:", error);
  }, [error]);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
        <CardDescription>
          We couldn&apos;t load your dashboard. This has been logged — try again, and reach out if
          it keeps happening.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}
