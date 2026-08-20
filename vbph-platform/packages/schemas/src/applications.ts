import { z } from "zod";

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Statuses a VA can still walk back from with "Withdraw" — excludes the
// two terminal end-states (REJECTED isn't the VA's to reverse; WITHDRAWN
// is already the target state).
export const WITHDRAWABLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const applyToJobSchema = z.object({
  coverNote: optionalText(2000),
  relevantExperience: optionalText(2000),
  notes: optionalText(2000),
  expectedAvailability: optionalText(200),
});
export type ApplyToJobInput = z.infer<typeof applyToJobSchema>;

export const applicationAdminStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
});
export type ApplicationAdminStatusInput = z.infer<typeof applicationAdminStatusSchema>;

export const addAdminNoteSchema = z.object({
  note: z.string().trim().min(1, "Note can't be empty").max(4000),
});
export type AddAdminNoteInput = z.infer<typeof addAdminNoteSchema>;
