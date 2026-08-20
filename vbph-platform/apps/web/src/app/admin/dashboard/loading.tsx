import { Card, CardContent, Skeleton } from "@vbph/ui";

export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="size-9 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-16" />
                </div>
                <Skeleton className="size-9 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
