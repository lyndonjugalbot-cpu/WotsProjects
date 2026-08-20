-- Fixes for vulnerabilities found in a full application security review
-- (see docs/security-review.md for the complete writeup, methodology, and
-- verification for every finding below). Five independent issues, none
-- overlapping in scope:
--
-- 1. Account suspension was enforced ONLY at the Next.js application
--    layer (requireRole/authenticateApiRequest checking profiles.status)
--    -- never at the database/RLS layer. A suspended user's still-valid
--    JWT could be used to make raw REST/RPC calls directly against
--    Supabase, completely bypassing suspension. Confirmed empirically: a
--    suspended VA could still INSERT a new time_entries row via a direct
--    REST call. This contradicts this schema's own repeated, explicit
--    claim that "RLS is the real enforcement, not just a convention."
--
-- 2/3. `time_entries`/`job_applications` could be INSERTed by a VA with
--    their review-status columns already set to an approved/hired value,
--    completely bypassing the intended human-review workflow -- for
--    time_entries specifically, this meant a VA could fabricate
--    pre-"approved" billable hours with zero admin involvement, which
--    would have flowed straight through timesheet locking into real
--    invoices and VA compensation figures.
--
-- 4. `timesheets` could be INSERTed already `LOCKED` with arbitrary
--    hand-picked hour totals, bypassing admin_set_timesheet_status()'s
--    atomic, segment-derived computation entirely -- undermining the
--    core guarantee the last two phases were built around ("a locked
--    timesheet's numbers are always exactly what was computed from real
--    segment data at lock time").
--
-- 5. A client company owner could set their own `clients.status` back to
--    'active' after an admin suspended it -- the same self-escalation bug
--    class already fixed for profiles.role/va_profiles.approval_status in
--    the admin_portal migration, but never applied to clients.

-- ── 1. Suspension as a real, database-level access boundary ────────────
--
-- active_uid() is a drop-in replacement for auth.uid() everywhere an RLS
-- policy or ownership-check helper uses it to establish "this is the
-- caller's own row": once a profile is suspended, this returns NULL
-- instead of the real uid, which makes every `x = active_uid()` /
-- `EXISTS (... = active_uid())` comparison it feeds into evaluate to
-- NULL (denied) -- the exact same shape of denial an unauthenticated
-- caller already gets from `x = auth.uid()` when auth.uid() is NULL.
--
-- This single function is deliberately the ONE place this check lives.
-- Redefining current_user_role() to route through it fixes every
-- "<table>_admin_all" policy and is_admin() (and everything that calls
-- is_admin()) in one change, since Postgres re-resolves a function body
-- on every call rather than caching it. The remaining direct auth.uid()
-- call sites (ownership helpers, a handful of inline "select/update own
-- row" policies) are each redefined below to match.
create or replace function public.active_uid()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (select 1 from public.profiles where id = auth.uid() and status = 'suspended') then null
    else auth.uid()
  end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = public.active_uid();
$$;

create or replace function public.is_client_member(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.client_members
    where client_id = target_client_id and profile_id = public.active_uid()
  );
$$;

create or replace function public.is_client_owner(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.client_members
    where client_id = target_client_id
      and profile_id = public.active_uid()
      and role_in_company = 'owner'
  );
$$;

create or replace function public.va_is_approved()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.va_profiles
    where id = public.active_uid() and approval_status = 'approved'
  );
$$;

create or replace function public.va_owns_placement(target_placement_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where id = target_placement_id and va_id = public.active_uid()
  );
$$;

create or replace function public.va_has_placement_on_project(target_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where project_id = target_project_id and va_id = public.active_uid()
  );
$$;

create or replace function public.va_has_placement_with_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where client_id = target_client_id and va_id = public.active_uid()
  );
$$;

-- Views with a direct auth.uid() reference in their own WHERE clause
-- (views whose WHERE only calls an already-fixed helper, e.g.
-- client_jobs_view/client_placements_view/admin_*_view, need no change --
-- they inherit the fix automatically).

create or replace view public.va_jobs_view
with (security_invoker = false)
as
select
  id,
  client_id,
  title,
  description,
  responsibilities,
  required_skills,
  experience_level,
  hours_per_week,
  timezone,
  schedule,
  va_hourly_rate,
  num_vas_required,
  application_deadline,
  status,
  created_at,
  updated_at
from public.jobs j
where
  is_admin()
  or (
    va_is_approved()
    and (
      status = 'OPEN'
      or exists (
        select 1 from public.job_applications ja
        where ja.job_id = j.id and ja.va_id = public.active_uid()
      )
      or exists (
        select 1 from public.placements p
        where p.job_id = j.id and p.va_id = public.active_uid()
      )
    )
  );

create or replace view public.va_placements_view
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
where p.va_id = public.active_uid() or public.is_admin();

create or replace view public.va_compensation_view
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
where t.status = 'LOCKED' and p.va_id = public.active_uid();

-- Inline "own row" policies (never routed through a helper function, so
-- each needs its own auth.uid() -> active_uid() swap). Same USING/WITH
-- CHECK shape as before in every case -- only the identity check changes.

drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = public.active_uid());

drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = public.active_uid()) with check (id = public.active_uid());

drop policy "va_profiles_select_own" on public.va_profiles;
create policy "va_profiles_select_own" on public.va_profiles
  for select using (id = public.active_uid());

drop policy "va_profiles_update_own" on public.va_profiles;
create policy "va_profiles_update_own" on public.va_profiles
  for update using (id = public.active_uid()) with check (id = public.active_uid());

drop policy "client_members_select_own" on public.client_members;
create policy "client_members_select_own" on public.client_members
  for select using (profile_id = public.active_uid());

drop policy "job_applications_select_own_va" on public.job_applications;
create policy "job_applications_select_own_va" on public.job_applications
  for select using (va_id = public.active_uid());

drop policy "job_applications_insert_approved_va" on public.job_applications;
create policy "job_applications_insert_approved_va" on public.job_applications
  for insert with check (va_id = public.active_uid() and public.va_is_approved() and public.job_is_open(job_id));

drop policy "job_applications_withdraw_own" on public.job_applications;
create policy "job_applications_withdraw_own" on public.job_applications
  for update
  using (va_id = public.active_uid())
  with check (va_id = public.active_uid() and status = 'WITHDRAWN');

drop policy "audit_logs_insert_self" on public.audit_logs;
create policy "audit_logs_insert_self" on public.audit_logs
  for insert with check (actor_id = public.active_uid());

-- ── 2/3. Review-status columns can never be set on a caller-originated
-- INSERT -- only ever by the admin RPCs (admin_set_time_entry_status,
-- and, for job_applications, the existing admin-only application-status
-- Server Action), which bypass column grants entirely as SECURITY
-- DEFINER. A VA's own INSERT can now only ever land at each table's own
-- default ('pending' / 'SUBMITTED') regardless of what the request body
-- contains -- the same "structural, not just RLS" pattern already used
-- for time_segments' boundary columns and jobs.agency_margin.
--
-- Also narrows time_entries' UPDATE grant to just `ended_at` -- the only
-- column a VA's own stopTimer() call legitimately needs to write. Status
-- itself was already correctly protected on UPDATE by
-- time_entries_update_va_pending's WITH CHECK (confirmed empirically --
-- a VA cannot flip status via UPDATE), but approved_by/approved_at were
-- not: a VA could stamp arbitrary values into their own still-pending
-- entry's review-audit columns, which is exactly the kind of tampering
-- those two columns exist to prevent.

revoke insert on public.time_entries from authenticated;
grant insert (placement_id, started_at, ended_at) on public.time_entries to authenticated;

revoke update on public.time_entries from authenticated;
grant update (ended_at) on public.time_entries to authenticated;

revoke insert on public.job_applications from authenticated;
grant insert (job_id, va_id, cover_note, relevant_experience, notes, expected_availability)
  on public.job_applications to authenticated;

-- ── 4. A timesheet can only ever be INSERTed as a fresh, OPEN row with
-- no hours -- exactly what the table's own defaults already produce.
-- Reaching LOCKED (or any other status, or a non-null hour figure) is
-- only possible through admin_set_timesheet_status(), which computes the
-- snapshot atomically from real segment data in the same transaction as
-- the status flip. This closes the gap where a plain INSERT (available
-- to any admin session, or anything else that reaches this table with
-- admin's grant) could fabricate an already-LOCKED timesheet with
-- arbitrary hour totals, bypassing that computation entirely.

revoke insert on public.timesheets from authenticated;
grant insert (placement_id, week_start) on public.timesheets to authenticated;

-- ── 5. clients.status is an ADMIN-IMPOSED restriction (suspend a
-- problematic client company), not client-owned business state -- same
-- category as profiles.role/va_profiles.approval_status, which already
-- got this exact protection in the admin_portal migration. A client
-- owner's own clients_update_owner policy has no reason to ever touch
-- this column; the trigger makes that structural rather than trusting
-- the policy was written narrowly enough.

create or replace function public.prevent_client_self_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can change a client''s status.';
  end if;
  return new;
end;
$$;

create trigger clients_prevent_self_status_change
  before update on public.clients
  for each row
  execute function public.prevent_client_self_status_change();
