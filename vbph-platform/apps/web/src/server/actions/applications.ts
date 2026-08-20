"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { applyToJobSchema } from "@vbph/schemas";

export type ApplicationActionState = {
  error: string | null;
  success?: boolean;
};

/**
 * Submits a job application. Every real authorization decision here is
 * re-checked at the DB layer regardless of what this function assumes:
 * job_applications_insert_approved_va's WITH CHECK independently verifies
 * va_id = auth.uid(), the VA is approved, and the job is OPEN
 * (job_is_open(), added specifically so a closed/draft/paused job can't
 * be applied to via a crafted request even if this UI never offers the
 * button). The unique (job_id, va_id) constraint blocks duplicates.
 */
export async function applyToJobAction(
  jobId: string,
  _prevState: ApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  const user = await requireRole("VA");

  const parsed = applyToJobSchema.safeParse({
    coverNote: formData.get("coverNote"),
    relevantExperience: formData.get("relevantExperience"),
    notes: formData.get("notes"),
    expectedAvailability: formData.get("expectedAvailability"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // The VA's profile is never copied onto the application row — it's read
  // live, joined at query time, by anyone authorized to view this
  // application (client who owns the job, or admin). See
  // server/queries/client/applicants.ts and server/queries/admin/applications.ts.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("job_applications").insert({
    job_id: jobId,
    va_id: user.id,
    cover_note: parsed.data.coverNote,
    relevant_experience: parsed.data.relevantExperience,
    notes: parsed.data.notes,
    expected_availability: parsed.data.expectedAvailability,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already applied to this job." };
    }
    if (error.message.toLowerCase().includes("row-level security")) {
      return { error: "This job is no longer accepting applications." };
    }
    return { error: "Couldn't submit your application. Please try again." };
  }

  revalidatePath(`/va/jobs/${jobId}`);
  revalidatePath("/va/jobs");
  return { error: null, success: true };
}

export async function withdrawApplicationAction(jobId: string): Promise<ApplicationActionState> {
  const user = await requireRole("VA");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("job_applications")
    .update({ status: "WITHDRAWN" })
    .eq("job_id", jobId)
    .eq("va_id", user.id);

  if (error) {
    return { error: "Couldn't withdraw your application. Please try again." };
  }

  revalidatePath(`/va/jobs/${jobId}`);
  revalidatePath("/va/jobs");
  revalidatePath("/va/applications");
  return { error: null, success: true };
}
