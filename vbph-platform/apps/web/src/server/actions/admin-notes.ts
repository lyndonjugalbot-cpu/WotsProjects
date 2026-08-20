"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { addAdminNoteSchema } from "@vbph/schemas";

export type AdminNoteActionState = {
  error: string | null;
};

/**
 * Adds a confidential note to a job application. requireRole("ADMIN")
 * here is the app-level gate; application_admin_notes_admin_all (RLS) is
 * the real enforcement — a non-admin session has no INSERT path to this
 * table regardless of what this function does.
 */
export async function addAdminNoteAction(
  applicationId: string,
  _prevState: AdminNoteActionState,
  formData: FormData
): Promise<AdminNoteActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = addAdminNoteSchema.safeParse({ note: formData.get("note") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("application_admin_notes").insert({
    application_id: applicationId,
    author_id: admin.id,
    note: parsed.data.note,
  });

  if (error) {
    return { error: "Couldn't save the note. Please try again." };
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  return { error: null };
}
