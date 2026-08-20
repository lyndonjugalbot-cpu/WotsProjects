import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeeklyHoursByPlacement } from "../shared/weekly-hours";

export interface AdminDashboardStats {
  activeClients: number;
  activeVas: number;
  openJobs: number;
  pendingApplications: number;
  activePlacements: number;
  hoursTrackedThisWeek: number;
  clientBillingsThisWeek: number;
  vaPayrollEstimateThisWeek: number;
  agencyGrossMarginThisWeek: number;
}

const IN_FLIGHT_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
];

/**
 * Platform-wide metrics — admin only. Rate fields (client billings, VA
 * payroll, margin) are computed here from admin_placements_view, the one
 * view that exposes all three rate columns together (see the
 * admin_portal migration) — never derive these from client_jobs_view or
 * va_jobs_view, each of which deliberately only has one of the two rates.
 */
export const getAdminDashboardStats = cache(async (): Promise<AdminDashboardStats> => {
  const supabase = await createSupabaseServerClient();

  const [
    { count: activeClients },
    { data: approvedVas },
    { count: openJobs },
    { count: pendingApplications },
    { data: activePlacements },
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("va_profiles").select("id").eq("approval_status", "approved"),
    supabase.from("admin_jobs_view").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .in("status", IN_FLIGHT_APPLICATION_STATUSES),
    supabase
      .from("admin_placements_view")
      .select("id, client_hourly_rate, va_hourly_rate")
      .eq("status", "active"),
  ]);

  const approvedVaIds = (approvedVas ?? []).map((v) => v.id);
  const { count: activeVaCount } =
    approvedVaIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("id", approvedVaIds)
          .eq("status", "active")
      : { count: 0 };

  const placements = (activePlacements ?? []).filter(
    (p): p is typeof p & { id: string; client_hourly_rate: number; va_hourly_rate: number } =>
      !!p.id && p.client_hourly_rate != null && p.va_hourly_rate != null
  );

  const hoursByPlacement = await getWeeklyHoursByPlacement(
    supabase,
    placements.map((p) => p.id)
  );

  let hoursTrackedThisWeek = 0;
  let clientBillingsThisWeek = 0;
  let vaPayrollEstimateThisWeek = 0;

  for (const placement of placements) {
    const hours = hoursByPlacement.get(placement.id) ?? 0;
    hoursTrackedThisWeek += hours;
    clientBillingsThisWeek += hours * placement.client_hourly_rate;
    vaPayrollEstimateThisWeek += hours * placement.va_hourly_rate;
  }

  return {
    activeClients: activeClients ?? 0,
    activeVas: activeVaCount ?? 0,
    openJobs: openJobs ?? 0,
    pendingApplications: pendingApplications ?? 0,
    activePlacements: placements.length,
    hoursTrackedThisWeek,
    clientBillingsThisWeek,
    vaPayrollEstimateThisWeek,
    // Computed as the difference, not summed independently from margin —
    // guarantees this number can never drift from "billings minus payroll"
    // even if a placement's stored margin were ever inconsistent.
    agencyGrossMarginThisWeek: clientBillingsThisWeek - vaPayrollEstimateThisWeek,
  };
});
