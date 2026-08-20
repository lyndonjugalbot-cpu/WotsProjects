import { Card, CardContent, Skeleton } from "@vbph/ui";

export default function VaDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
