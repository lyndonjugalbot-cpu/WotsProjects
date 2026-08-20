import { z } from "zod";

// `.guid()`, not `.uuid()` — see packages/schemas/src/admin.ts for why:
// this project's seed ids aren't RFC 4122 UUIDs, and real
// `gen_random_uuid()` output satisfies `.guid()` too.

export const startTimerSchema = z.object({
  placementId: z.string().guid("A valid placement id is required"),
});
export type StartTimerInput = z.infer<typeof startTimerSchema>;

const activityCount = z.coerce.number().int().nonnegative().max(1_000_000);
const activityPercentage = z.coerce.number().int().min(0).max(100);

export const stopTimerSchema = z.object({
  // Optional — omitted on a normal Stop-button call (the server uses its
  // own clock). Supplied only by the desktop app's stale-session
  // reconciliation path after an unclean shutdown: the last moment the
  // app can actually verify tracking was active, so the unobserved gap
  // after a crash never gets silently counted as clocked-in time. See
  // stopTimer() in service.ts and docs/database.md ("Offline resilience
  // in the desktop app").
  endedAt: z.string().datetime({ message: "endedAt must be an ISO 8601 timestamp" }).optional(),
});
export type StopTimerInput = z.infer<typeof stopTimerSchema>;

export const createSegmentSchema = z
  .object({
    timeEntryId: z.string().guid("A valid time entry id is required"),
    // Client-generated, required — the idempotency key that lets a
    // retried request (the caller doesn't know whether an earlier
    // attempt actually landed before the connection dropped) be
    // recognized as the SAME segment instead of creating a duplicate.
    // See createSegment() in service.ts and docs/database.md.
    clientSegmentId: z.string().guid("A valid client-generated segment id is required"),
    segmentStart: z.string().datetime({ message: "segmentStart must be an ISO 8601 timestamp" }),
    segmentEnd: z.string().datetime({ message: "segmentEnd must be an ISO 8601 timestamp" }),
    keyboardActivityCount: activityCount.nullable().optional(),
    mouseActivityCount: activityCount.nullable().optional(),
    activityPercentage: activityPercentage.nullable().optional(),
    memo: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .refine((data) => new Date(data.segmentEnd) > new Date(data.segmentStart), {
    message: "segmentEnd must be after segmentStart",
    path: ["segmentEnd"],
  })
  .refine(
    (data) => new Date(data.segmentEnd).getTime() - new Date(data.segmentStart).getTime() <= 10 * 60 * 1000,
    { message: "A segment can't exceed 10 minutes", path: ["segmentEnd"] }
  );
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;

export const recordActivitySchema = z
  .object({
    keyboardActivityCount: activityCount.nullable().optional(),
    mouseActivityCount: activityCount.nullable().optional(),
    activityPercentage: activityPercentage.nullable().optional(),
  })
  .refine(
    (data) =>
      data.keyboardActivityCount !== undefined ||
      data.mouseActivityCount !== undefined ||
      data.activityPercentage !== undefined,
    { message: "Provide at least one of keyboardActivityCount, mouseActivityCount, activityPercentage" }
  );
export type RecordActivityInput = z.infer<typeof recordActivitySchema>;

export const workDiaryQuerySchema = z.object({
  vaId: z.string().guid().optional(),
  placementId: z.string().guid().optional(),
  projectId: z.string().guid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});
export type WorkDiaryQuery = z.infer<typeof workDiaryQuerySchema>;

// 15 MB — comfortably above a typical compressed screenshot, well below
// anything that would make an accidental/malicious upload expensive.
export const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_SCREENSHOT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
