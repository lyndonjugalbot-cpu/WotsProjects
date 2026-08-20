import { Badge, type BadgeProps } from "@vbph/ui";
import type { JobStatus } from "@vbph/schemas";

const STATUS_VARIANT: Record<JobStatus, NonNullable<BadgeProps["variant"]>> = {
  DRAFT: "default",
  OPEN: "success",
  PAUSED: "warning",
  FILLED: "primary",
  CLOSED: "destructive",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}
