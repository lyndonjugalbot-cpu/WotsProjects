-- Rate-privacy views — the only read path CLIENT and VA roles have to job
-- and placement data.
--
-- HOW THIS ACTUALLY WORKS (read this before touching this file):
--
-- Row Level Security is enforced against the role invoking the query. A
-- plain view, by default (security_invoker = false, which we set
-- explicitly below rather than relying on the unstated default), checks
-- permissions against the VIEW OWNER instead — and the view owner here is
-- the migration role, which bypasses RLS on the underlying tables entirely
-- (Postgres never applies RLS to a table's owner). That means:
--   1. jobs/placements have NO select policy for CLIENT/VA (previous
--      migrations) — direct queries against those tables return zero rows.
--   2. These views CAN read every row of jobs/placements (owner bypasses
--      RLS) but only SELECT the columns listed below — the sensitive
--      columns are never in the view's output at all, not just filtered.
--   3. The WHERE clause in each view is OUR OWN row-scoping logic (who
--      gets to see this specific row), written by us — since the
--      underlying tables' RLS isn't doing that job for a view query, this
--      WHERE clause IS the security boundary. Do not remove it "to
--      simplify" without understanding this.
--
-- We also REVOKE SELECT on the base tables from `authenticated` outright,
-- below — a second, independent layer, so a future migration that
-- accidentally added a permissive policy to jobs/placements still
-- wouldn't expose them; the table-level grant would still be closed.

revoke select on public.jobs from authenticated;
revoke select on public.placements from authenticated;
-- (admin already reads these directly via RLS + the `postgres`/admin
-- Supabase role hierarchy; service_role always bypasses RLS regardless.)

create view public.client_jobs_view
with (security_invoker = false)
as
select
  j.id,
  j.client_id,
  j.title,
  j.description,
  j.requirements,
  j.hours_per_week,
  j.timezone,
  j.schedule,
  j.client_hourly_rate,
  j.status,
  j.created_by,
  j.created_at,
  j.updated_at
from public.jobs j
where public.is_client_member(j.client_id) or public.is_admin();

comment on view public.client_jobs_view is
  'Client-facing job reads. No agency_margin/va_hourly_rate column — see file header for why that is safe.';

create view public.va_jobs_view
with (security_invoker = false)
as
select
  j.id,
  j.client_id,
  j.title,
  j.description,
  j.requirements,
  j.hours_per_week,
  j.timezone,
  j.schedule,
  j.va_hourly_rate,
  j.status,
  j.created_at,
  j.updated_at
from public.jobs j
where
  public.is_admin()
  or (
    public.va_is_approved()
    and (
      j.status = 'open'
      or exists (
        select 1 from public.job_applications ja
        where ja.job_id = j.id and ja.va_id = auth.uid()
      )
      or exists (
        select 1 from public.placements p
        where p.job_id = j.id and p.va_id = auth.uid()
      )
    )
  );

comment on view public.va_jobs_view is
  'VA-facing job reads: open marketplace jobs, plus any job the VA applied to or was placed on. No client_hourly_rate/agency_margin column.';

create view public.client_placements_view
with (security_invoker = false)
as
select
  p.id,
  p.client_id,
  p.va_id,
  p.job_id,
  p.project_id,
  p.client_hourly_rate,
  p.hours_per_week_expected,
  p.start_date,
  p.end_date,
  p.status,
  p.created_at,
  p.updated_at
from public.placements p
where public.is_client_member(p.client_id) or public.is_admin();

comment on view public.client_placements_view is
  'Client-facing placement reads. No agency_margin/va_hourly_rate column.';

create view public.va_placements_view
with (security_invoker = false)
as
select
  p.id,
  p.client_id,
  p.va_id,
  p.job_id,
  p.project_id,
  p.va_hourly_rate,
  p.hours_per_week_expected,
  p.start_date,
  p.end_date,
  p.status,
  p.created_at,
  p.updated_at
from public.placements p
where p.va_id = auth.uid() or public.is_admin();

comment on view public.va_placements_view is
  'VA-facing placement reads. No client_hourly_rate/agency_margin column.';

grant select on public.client_jobs_view to authenticated;
grant select on public.va_jobs_view to authenticated;
grant select on public.client_placements_view to authenticated;
grant select on public.va_placements_view to authenticated;
