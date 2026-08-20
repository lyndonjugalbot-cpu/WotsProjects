"use client";

import { useActionState } from "react";
import { Button, Input, Label, Textarea } from "@vbph/ui";
import { updateVaProfileAction, type AdminActionState } from "@/server/actions/admin-vas";
import type { AdminVaDetail } from "@/server/queries/admin/vas";

const initialState: AdminActionState = { error: null };

export function VaProfileForm({ va }: { va: AdminVaDetail }) {
  const [state, formAction, pending] = useActionState(
    updateVaProfileAction.bind(null, va.id),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" name="headline" defaultValue={va.headline ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" name="bio" defaultValue={va.bio ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="skills">Skills</Label>
          <Input id="skills" name="skills" defaultValue={va.skills.join(", ")} placeholder="Comma-separated" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="experienceYears">Years of experience</Label>
          <Input id="experienceYears" name="experienceYears" type="number" min={0} defaultValue={va.experienceYears ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={va.timezone ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resumeUrl">Resume URL</Label>
          <Input id="resumeUrl" name="resumeUrl" defaultValue={va.resumeUrl ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="portfolioUrl">Portfolio URL</Label>
          <Input id="portfolioUrl" name="portfolioUrl" defaultValue={va.portfolioUrl ?? ""} />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
