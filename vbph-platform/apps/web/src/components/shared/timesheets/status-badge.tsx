import { Badge } from "@vbph/ui";
import type { TimesheetStatus } from "@vbph/schemas";

const VARIANT_BY_STATUS: Record<TimesheetStatus, "default" | "warning" | "primary" | "success"> = {
  OPEN: "default",
  SUBMITTED: "warning",
  APPROVED: "primary",
  LOCKED: "success",
};

export function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>;
}
