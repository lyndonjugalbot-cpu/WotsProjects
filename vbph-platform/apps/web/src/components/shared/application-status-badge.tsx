import { Badge, type BadgeProps } from "@vbph/ui";
import type { ApplicationStatus } from "@vbph/schemas";

const STATUS_VARIANT: Record<ApplicationStatus, NonNullable<BadgeProps["variant"]>> = {
  SUBMITTED: "default",
  UNDER_REVIEW: "default",
  SHORTLISTED: "primary",
  INTERVIEW: "primary",
  OFFERED: "warning",
  HIRED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "destructive",
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
