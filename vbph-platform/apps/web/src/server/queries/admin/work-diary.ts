import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWorkDiaryBlocks, type WorkDiaryResult } from "@/server/time-tracking/service";

/** Every tracked block platform-wide for a date range — admin only (time_entries_admin_all). */
export const getAdminWorkDiary = cache(
  async (startDate: string, endDate: string): Promise<WorkDiaryResult> => {
    const supabase = await createSupabaseServerClient();
    return getWorkDiaryBlocks(supabase, createSupabaseAdminClient(), { startDate, endDate });
  }
);
