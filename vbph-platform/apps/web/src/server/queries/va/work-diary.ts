import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWorkDiaryBlocks, type WorkDiaryResult } from "@/server/time-tracking/service";

/**
 * The VA's own Work Diary for a date range — RLS
 * (time_entries_select_va/time_segments_select_va) already scopes this
 * to the caller's own tracked time; no vaId filter is passed, it isn't
 * needed.
 */
export const getVaWorkDiary = cache(
  async (startDate: string, endDate: string): Promise<WorkDiaryResult> => {
    const supabase = await createSupabaseServerClient();
    return getWorkDiaryBlocks(supabase, createSupabaseAdminClient(), { startDate, endDate });
  }
);
