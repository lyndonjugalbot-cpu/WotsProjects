"use client";

import { useActionState } from "react";
import { Button, Textarea } from "@vbph/ui";
import { addAdminNoteAction, type AdminNoteActionState } from "@/server/actions/admin-notes";

const initialState: AdminNoteActionState = { error: null };

export function AdminNoteForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState(
    addAdminNoteAction.bind(null, applicationId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Textarea name="note" placeholder="Add a confidential note about this applicant…" required />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Add Note"}
      </Button>
    </form>
  );
}
