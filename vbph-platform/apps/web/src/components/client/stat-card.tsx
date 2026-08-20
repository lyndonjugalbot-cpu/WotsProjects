import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@vbph/ui";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
