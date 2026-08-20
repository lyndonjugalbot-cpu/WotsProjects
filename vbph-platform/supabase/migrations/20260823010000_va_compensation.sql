-- Internal VA compensation calculation — explicitly NOT payroll/payment
-- yet (nothing here transfers money or marks anything paid; VA payout
-- already happens, if at all, through the existing `payments` table
-- against an actual invoice). This is a read-only calculation-and-visibility
-- layer: Approved Hours x Placement VA Hourly Rate, alongside the
-- matching Client Revenue and Gross Agency Margin figures for admin.
--
-- Deliberately computed from `timesheets` directly, NOT from
-- `invoice_items` — a VA's compensation for their own approved work
-- shouldn't be gated behind whether an admin has gotten around to
-- generating that client's invoice yet (invoicing runs on the CLIENT's
-- billing cadence; compensation is about the VA's own locked, approved
-- hours, which exist as soon as their timesheet is LOCKED). Both figures
-- ultimately agree when an invoice IS generated, because both read the
-- exact same frozen inputs: `timesheets.approved_hours` (frozen at lock,
-- widened to 4 decimal places in the weekly_timesheets/weekly_invoices
-- migrations specifically so this kind of billing math is exact) and
-- `placements.client_hourly_rate`/`va_hourly_rate` (an immutable
-- per-placement snapshot, never a live reference to a job's current
-- rate — see docs/database.md).
--
-- Two views, not one filtered by role in application code — the same
-- reasoning as every other rate-privacy boundary in this schema: which
-- COLUMNS a query can even reach should be structural, not something
-- correct behavior depends on the caller remembering to filter.
--   - admin_compensation_view: Client Revenue, VA Compensation, Gross
--     Margin together — admin-only, `where is_admin()`, no membership
--     OR-clause, same shape as admin_placements_view/admin_invoice_items_view.
--   - va_compensation_view: Hours, the VA's OWN rate, and Expected
--     Compensation ONLY. client_hourly_rate and any margin figure are
--     structurally absent from this view's column list -- not filtered
--     out, never selected into it in the first place. Row-scoped to
--     `p.va_id = auth.uid()`, so a VA only ever sees their own rows.
--
-- Neither view is reachable by a CLIENT session at all: no client-facing
-- view exists for this, and neither view grants a client-scoped
-- row-visibility clause -- a client session gets zero rows from either,
-- confirmed in Verification.

create view public.admin_compensation_view
  with (security_invoker = false) as
  select
    t.id as timesheet_id,
    t.placement_id,
    p.client_id,
    p.va_id,
    t.week_start,
    t.week_end,
    t.approved_hours,
    p.client_hourly_rate,
    p.va_hourly_rate,
    round(t.approved_hours * p.client_hourly_rate, 2) as client_revenue,
    round(t.approved_hours * p.va_hourly_rate, 2) as va_compensation,
    round(t.approved_hours * (p.client_hourly_rate - p.va_hourly_rate), 2) as gross_margin
  from public.timesheets t
  join public.placements p on p.id = t.placement_id
  where t.status = 'LOCKED' and public.is_admin();

comment on view public.admin_compensation_view is
  'Admin-only. Client Revenue / VA Compensation / Gross Margin per LOCKED timesheet — see the migration header for why this reads timesheets directly rather than invoice_items.';

create view public.va_compensation_view
  with (security_invoker = false) as
  select
    t.id as timesheet_id,
    t.placement_id,
    t.week_start,
    t.week_end,
    t.approved_hours,
    p.va_hourly_rate,
    round(t.approved_hours * p.va_hourly_rate, 2) as expected_compensation
  from public.timesheets t
  join public.placements p on p.id = t.placement_id
  where t.status = 'LOCKED' and p.va_id = auth.uid();

comment on view public.va_compensation_view is
  'A VA''s own Hours / Rate / Expected Compensation per LOCKED timesheet. No client_hourly_rate or margin column exists on this view at all.';

grant select on public.admin_compensation_view to authenticated;
grant select on public.va_compensation_view to authenticated;
