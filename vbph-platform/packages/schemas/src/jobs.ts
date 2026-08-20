import { z } from "zod";

// Shared between the Server Action (always re-validates, never trusts the
// client) and the job form's client-side validation for immediate feedback.
//
// Deliberately excludes `agencyMargin` and `vaHourlyRate` — there is no
// field here a client could set to influence either. Agency margin is a
// server-side default applied at insert time; the VA-facing rate is a
// DB-generated column derived from client_hourly_rate - agency_margin.
// See docs/database.md and the job_posting_fields migration.

export const JOB_EXPERIENCE_LEVELS = ["ENTRY", "INTERMEDIATE", "EXPERT"] as const;
export type JobExperienceLevel = (typeof JOB_EXPERIENCE_LEVELS)[number];

export const JOB_STATUSES = ["DRAFT", "OPEN", "PAUSED", "FILLED", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// Statuses a client is allowed to set directly from the job form. FILLED is
// intentionally reachable too (a client may fill a role outside the
// platform and wants to stop taking applications) but is not the default
// for either submit action.
export const CLIENT_SETTABLE_STATUSES = JOB_STATUSES;

const skillsField = z
  .array(z.string().trim().min(1).max(60))
  .max(20, "List at most 20 skills")
  .default([]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const jobFormSchema = z.object({
  title: z.string().trim().min(3, "Job title must be at least 3 characters").max(200),
  description: optionalText(5000),
  responsibilities: optionalText(5000),
  requiredSkills: skillsField,
  experienceLevel: z
    .union([z.enum(JOB_EXPERIENCE_LEVELS), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v ? v : null)),
  hoursPerWeek: z.coerce
    .number()
    .int("Hours per week must be a whole number")
    .positive("Hours per week must be greater than 0")
    .max(168, "Hours per week can't exceed 168")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  schedule: optionalText(200),
  timezone: optionalText(100),
  clientHourlyRate: z.coerce
    .number()
    .positive("Hourly rate must be greater than $0")
    .max(1000, "Hourly rate seems too high — double-check it"),
  numVasRequired: z.coerce
    .number()
    .int("Number of VAs must be a whole number")
    .positive("At least 1 VA is required")
    .max(50, "Number of VAs seems too high — double-check it")
    .default(1),
  applicationDeadline: z
    .union([z.string().trim().min(1), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), {
      message: "Enter a valid application deadline",
    }),
});
export type JobFormInput = z.infer<typeof jobFormSchema>;

export const jobStatusSchema = z.object({
  status: z.enum(JOB_STATUSES),
});
export type JobStatusInput = z.infer<typeof jobStatusSchema>;
