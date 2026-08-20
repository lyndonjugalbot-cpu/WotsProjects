import { Badge } from "@vbph/ui";
import type { InvoiceStatus } from "@vbph/schemas";

const VARIANT_BY_STATUS: Record<InvoiceStatus, "default" | "warning" | "primary" | "success" | "destructive"> = {
  DRAFT: "default",
  ISSUED: "primary",
  OVERDUE: "destructive",
  PAID: "success",
  VOID: "warning",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>;
}
