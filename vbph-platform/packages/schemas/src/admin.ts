import { z } from "zod";

// `.guid()`, not `.uuid()`: this project's seed data uses hand-crafted ids
// like `b0000000-0000-0000-0000-000000000002` for readability, which are
// valid 8-4-4-4-12 hex GUIDs but not RFC 4122 UUIDs — the version nibble
// (`1-8`) and variant nibble (`89ab`) are both `0`. Zod v4's `.uuid()`
// enforces those nibbles strictly and rejects every id in this dataset;
// `.guid()` only checks the general shape. Real `gen_random_uuid()` output
// (used everywhere id generation isn't hardcoded) satisfies `.guid()` too,
// so this isn't a real-world validation loosening, only a seed-data one.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

// ── Users ────────────────────────────────────────────────────────────────

export const CREATABLE_ROLES = ["CLIENT", "VA", "ADMIN"] as const;
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    fullName: z.string().trim().min(2, "Enter a full name").max(120),
    role: z.enum(CREATABLE_ROLES),
    // Only meaningful when role === "CLIENT": attach to an existing company,
    // or create a new one inline.
    clientId: z.string().guid().optional(),
    newCompanyName: optionalText(200),
  })
  .refine((data) => data.role !== "CLIENT" || !!data.clientId || !!data.newCompanyName, {
    message: "Select an existing company or enter a new company name",
    path: ["clientId"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter a full name").max(120),
  phone: optionalText(40),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateVaProfileSchema = z.object({
  headline: optionalText(200),
  bio: optionalText(4000),
  skills: z
    .array(z.string().trim().min(1).max(60))
    .max(30)
    .default([]),
  experienceYears: z.coerce.number().int().min(0).max(60).nullable().optional().transform((v) => v ?? null),
  timezone: optionalText(100),
  resumeUrl: optionalText(500),
  portfolioUrl: optionalText(500),
});
export type UpdateVaProfileInput = z.infer<typeof updateVaProfileSchema>;

export const VA_APPROVAL_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const vaApprovalSchema = z.object({
  approvalStatus: z.enum(VA_APPROVAL_STATUSES),
  rejectionReason: optionalText(1000),
});
export type VaApprovalInput = z.infer<typeof vaApprovalSchema>;

export const updateClientProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Enter a company name").max(200),
  billingEmail: z
    .union([z.string().trim().toLowerCase().email(), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v ? v : null)),
  industry: optionalText(100),
  website: optionalText(300),
});
export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;

// ── Rates ────────────────────────────────────────────────────────────────
// Only two fields are ever submitted — client rate and VA rate. Margin is
// always server-computed as their difference (see the admin_update_*_rates
// RPCs) so there is no code path where a submitted margin could disagree
// with the other two.

export const rateOverrideSchema = z
  .object({
    clientHourlyRate: z.coerce.number().positive("Client rate must be greater than $0").max(1000),
    vaHourlyRate: z.coerce.number().nonnegative("VA rate can't be negative").max(1000),
  })
  .refine((data) => data.vaHourlyRate <= data.clientHourlyRate, {
    message: "VA rate can't exceed the client rate — margin would be negative",
    path: ["vaHourlyRate"],
  });
export type RateOverrideInput = z.infer<typeof rateOverrideSchema>;

// ── Placements & Projects ───────────────────────────────────────────────

export const PLACEMENT_STATUSES = ["PENDING", "ACTIVE", "PAUSED", "ENDED"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export const createPlacementSchema = z
  .object({
    clientId: z.string().guid("Select a client"),
    vaId: z.string().guid("Select a VA"),
    jobId: z
      .union([z.string().guid(), z.literal(""), z.null(), z.undefined()])
      .transform((v) => (v ? v : null)),
    projectId: z
      .union([z.string().guid(), z.literal(""), z.null(), z.undefined()])
      .transform((v) => (v ? v : null)),
    clientHourlyRate: z.coerce.number().positive("Client rate must be greater than $0").max(1000),
    vaHourlyRate: z.coerce.number().nonnegative("VA rate can't be negative").max(1000),
    hoursPerWeekExpected: z.coerce
      .number()
      .int()
      .positive()
      .max(168)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    startDate: z.string().trim().min(1, "Choose a start date"),
    status: z.enum(PLACEMENT_STATUSES).default("PENDING"),
  })
  .refine((data) => data.vaHourlyRate <= data.clientHourlyRate, {
    message: "VA rate can't exceed the client rate — margin would be negative",
    path: ["vaHourlyRate"],
  });
export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;

export const placementStatusSchema = z.object({
  status: z.enum(PLACEMENT_STATUSES),
});

export const createProjectSchema = z.object({
  clientId: z.string().guid("Select a client"),
  name: z.string().trim().min(2, "Enter a project name").max(200),
  description: optionalText(2000),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
