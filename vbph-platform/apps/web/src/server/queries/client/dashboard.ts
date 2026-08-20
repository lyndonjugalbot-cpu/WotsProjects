import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamMembers } from "./team";

export interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
}

export interface DashboardStats {
  activeVaCount: number;
  activeProjectCount: number;
  hoursTrackedThisWeek: number;
  estimatedWeeklyInvoice: number;
  outstandingInvoiceCount: number;
  outstandingInvoiceTotal: number;
  openJobsCount: number;
  recentActivity: ActivityItem[];
}

export const getDashboardStats = cache(async (clientId: string): Promise<DashboardStats> => {
  const supabase = await createSupabaseServerClient();

  const [team, projectsResult, invoicesResult, openJobsResult] = await Promise.all([
    getTeamMembers(clientId),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "active"),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_jobs_view")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "OPEN"),
  ]);

  const invoices = invoicesResult.data ?? [];
  const outstanding = invoices.filter((inv) => inv.status === "sent" || inv.status === "overdue");
  const activeVas = team.filter((t) => t.status === "ACTIVE");
  const hoursTrackedThisWeek = team.reduce((sum, t) => sum + t.hoursTrackedThisWeek, 0);
  const estimatedWeeklyInvoice = team.reduce(
    (sum, t) => sum + t.hoursTrackedThisWeek * t.clientHourlyRate,
    0
  );

  const recentActivity = await getRecentActivity(clientId, invoices);

  return {
    activeVaCount: activeVas.length,
    activeProjectCount: projectsResult.count ?? 0,
    hoursTrackedThisWeek,
    estimatedWeeklyInvoice,
    outstandingInvoiceCount: outstanding.length,
    outstandingInvoiceTotal: outstanding.reduce((sum, inv) => sum + inv.total, 0),
    openJobsCount: openJobsResult.count ?? 0,
    recentActivity,
  };
});

async function getRecentActivity(
  clientId: string,
  invoices: { id: string; invoice_number: string; total: number; status: string; created_at: string }[]
): Promise<ActivityItem[]> {
  const supabase = await createSupabaseServerClient();

  const invoiceActivity: ActivityItem[] = invoices.slice(0, 3).map((inv) => ({
    id: `invoice-${inv.id}`,
    description: `Invoice ${inv.invoice_number} ${inv.status === "paid" ? "was paid" : `issued for $${inv.total.toFixed(2)}`}`,
    timestamp: inv.created_at,
  }));

  const { data: placements } = await supabase
    .from("client_placements_view")
    .select("id, va_id, created_at, status")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(3);

  const vaIds = [
    ...new Set((placements ?? []).map((p) => p.va_id).filter((id): id is string => !!id)),
  ];
  const { data: profiles } =
    vaIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", vaIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "A VA"]));

  const placementActivity: ActivityItem[] = (placements ?? [])
    .filter((p): p is typeof p & { id: string; created_at: string } => !!p.id && !!p.created_at)
    .map((p) => ({
      id: `placement-${p.id}`,
      description: `${nameById.get(p.va_id ?? "") ?? "A VA"} joined your team`,
      timestamp: p.created_at,
    }));

  return [...invoiceActivity, ...placementActivity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);
}
