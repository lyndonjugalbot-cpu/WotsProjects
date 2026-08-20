"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { applicationAdminStatusSchema } from "@vbph/schemas";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

export async function updateApplicationStatusAction(
  applicationId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = applicationAdminStatusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ status: parsed.data.status })
    .eq("id", applicationId);

  if (error) {
    return { error: "Couldn't update application status. Please try again." };
  }

  await logAdminAction(
    supabase,
    admin.id,
    "application_status_changed",
    "job_applications",
    applicationId,
    parsed.data
  );

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/admin/applications");
  return { error: null };
}
