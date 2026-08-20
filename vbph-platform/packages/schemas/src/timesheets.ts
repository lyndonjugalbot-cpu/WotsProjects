import { z } from "zod";

// See packages/schemas/src/admin.ts for why `.guid()`, not `.uuid()`, is
// used everywhere an id from this project's dataset might arrive.

export const TIMESHEET_STATUSES = ["OPEN", "SUBMITTED", "APPROVED", "LOCKED"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const TIME_ENTRY_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type TimeEntryReviewStatus = (typeof TIME_ENTRY_REVIEW_STATUSES)[number];

// Forward-only, one step at a time — see admin_set_timesheet_status() in
// the weekly_timesheets migration, which is the actual enforcement; this
// only validates that the submitted value is a real status at all before
// it ever reaches the RPC.
export const advanceTimesheetStatusSchema = z.object({
  newStatus: z.enum(TIMESHEET_STATUSES),
});
export type AdvanceTimesheetStatusInput = z.infer<typeof advanceTimesheetStatusSchema>;

export const setTimeEntryStatusSchema = z.object({
  status: z.enum(TIME_ENTRY_REVIEW_STATUSES),
});
export type SetTimeEntryStatusInput = z.infer<typeof setTimeEntryStatusSchema>;

// A correction to an already-LOCKED timesheet's frozen hours — see
// admin_correct_locked_timesheet(). `reason` is required (not just
// encouraged): the RPC itself also rejects an empty one, but validating
// it here gives the admin a proper inline form error instead of a raw
// database exception.
export const correctLockedTimesheetSchema = z.object({
  trackedHours: z.coerce.number().min(0, "Can't be negative").max(168, "Can't exceed a full week"),
  approvedHours: z.coerce.number().min(0, "Can't be negative").max(168, "Can't exceed a full week"),
  rejectedHours: z.coerce.number().min(0, "Can't be negative").max(168, "Can't exceed a full week"),
  pendingHours: z.coerce.number().min(0, "Can't be negative").max(168, "Can't exceed a full week"),
  reason: z
    .string()
    .trim()
    .min(10, "Explain the correction in at least 10 characters — this becomes part of the audit record")
    .max(2000),
});
export type CorrectLockedTimesheetInput = z.infer<typeof correctLockedTimesheetSchema>;
