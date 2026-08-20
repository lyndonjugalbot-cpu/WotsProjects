import { Card, CardContent, Skeleton } from "@vbph/ui";

// Automatic Suspense fallback for this route segment while the dashboard's
// server-side data fetches resolve — Next.js renders this immediately, no
// client-side spinner wiring needed.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
