-- Client Job Posting system: add missing form fields, add PAUSED status,
-- normalize status values to uppercase, and lock down column-level write
-- access so a client can never set agency_margin (or read it/va_hourly_rate)
-- through the jobs table directly.

-- The rate-privacy views select from `jobs` directly, so they must be
-- dropped before altering the columns they depend on and recreated below.
drop view public.client_jobs_view;
drop view public.va_jobs_view;

-- ── New columns required by the job posting form ──────────────────────

alter table public.jobs
  add column responsibilities text,
  add column required_skills text[] not null default '{}',
  add column experience_level text
    check (experience_level is null or experience_level in ('ENTRY', 'INTERMEDIATE', 'EXPERT')),
  add column num_vas_required integer not null default 1
    check (num_vas_required > 0),
  add column application_deadline date;

-- `requirements` is superseded by the more structured `responsibilities` +
-- `required_skills` columns above.
alter table public.jobs drop column requirements;

-- ── Fix two pre-existing RLS gaps: client job updates never actually work ─
--
-- Gap 1: `jobs` deliberately has no SELECT policy for CLIENT/VA at all
-- (rate privacy — see rate_privacy_views migration). But an
-- `UPDATE ... WHERE id = ? AND client_id = ?` still needs to read the
-- existing row to evaluate that WHERE clause, and per Postgres's RLS
-- model that read is governed by SELECT policies, not UPDATE policies
-- (see CREATE POLICY docs: "the query's WHERE clause ... is still
-- subject to the table's SELECT policies"). With zero SELECT policies
-- applicable to a client, every row was invisible to the WHERE clause
-- and every client UPDATE silently matched 0 rows. This narrow policy
-- only restores enough visibility to evaluate id/client_id in a WHERE —
-- combined with the column-level grant above (only id, client_id are
-- SELECT-granted to `authenticated`), a client still cannot read
-- client_hourly_rate, agency_margin, or va_hourly_rate off the base
-- table; that still only happens through client_jobs_view.
create policy jobs_select_owner_columns on public.jobs
  for select
  using (is_client_owner(client_id));

-- Gap 2: jobs_update_owner specifies USING (is_client_owner(...)) but no
-- WITH CHECK. jobs_admin_all is a separate FOR ALL policy with an
-- explicit WITH CHECK (admin-only). Postgres combines permissive
-- policies' WITH CHECK clauses by OR, but a policy that omits WITH CHECK
-- contributes nothing to that OR-set (it does NOT fall back to its own
-- USING clause once another applicable policy supplies an explicit WITH
-- CHECK) — so the effective WITH CHECK for UPDATE was admin-only, and no
-- client could ever complete a job update even once gap 1 above is fixed.
alter policy jobs_update_owner on public.jobs
  with check (is_client_owner(client_id));

-- Same root cause, same fix, found by auditing every UPDATE/ALL policy
-- pair in the schema once the jobs bug above turned up (see
-- `select tablename, policyname, cmd, qual is not null, with_check is not
-- null from pg_policies where cmd in ('UPDATE','ALL')`). Each of these
-- was previously a dead end for the actor it names — dormant until a
-- feature actually exercised a client/admin update through it.
alter policy clients_update_owner on public.clients
  with check (is_client_owner(id));

alter policy projects_update_owner on public.projects
  with check (is_client_owner(client_id));

alter policy profiles_update_admin on public.profiles
  with check (current_user_role() = 'ADMIN'::user_role);

alter policy va_profiles_update_admin on public.va_profiles
  with check (current_user_role() = 'ADMIN'::user_role);

-- ── Status: add PAUSED, normalize to uppercase ─────────────────────────

alter table public.jobs alter column status drop default;

update public.jobs set status = upper(status);

alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('DRAFT', 'OPEN', 'PAUSED', 'FILLED', 'CLOSED'));

alter table public.jobs alter column status set default 'DRAFT';

-- ── Column-level grants: agency_margin must never be client-writable ───
-- The base table already has no SELECT grant for `authenticated` (see
-- rate_privacy_views migration); this closes the write side of the same
-- gap. Without this, the blanket table-level INSERT/UPDATE granted in
-- fix_baseline_grants.sql would let a client set agency_margin directly
-- via a hand-crafted PostgREST request, bypassing the UI entirely.

revoke insert, update on public.jobs from authenticated;

-- `id` is included so the app can generate the UUID client-side and know
-- the new row's id without needing INSERT ... RETURNING, which would
-- otherwise require a SELECT grant on the base table (revoked for
-- rate-privacy reasons — see rate_privacy_views migration).
grant insert (
  id, client_id, title, description, responsibilities, required_skills,
  experience_level, hours_per_week, timezone, schedule,
  client_hourly_rate, num_vas_required, application_deadline,
  status, created_by
) on public.jobs to authenticated;

grant update (
  title, description, responsibilities, required_skills,
  experience_level, hours_per_week, timezone, schedule,
  client_hourly_rate, num_vas_required, application_deadline, status
) on public.jobs to authenticated;

-- An UPDATE ... WHERE id = ? AND client_id = ? needs column-level SELECT
-- on `id`/`client_id` to evaluate that WHERE clause at all — this is a
-- Postgres privilege check independent of RLS. Combined with the
-- jobs_select_owner_columns policy above, a client can now read their own
-- rows' id/client_id (not zero rows) — but nothing else: every other
-- column (client_hourly_rate, agency_margin, va_hourly_rate, title, ...)
-- has no SELECT grant at all here, so `select client_hourly_rate from
-- jobs` still fails outright regardless of row ownership. That data still
-- only ever flows through client_jobs_view/va_jobs_view.
grant select (id, client_id) on public.jobs to authenticated;

-- ── Rebuild the rate-privacy views with the new columns ────────────────

create view public.client_jobs_view
  with (security_invoker = false) as
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
    client_hourly_rate,
    num_vas_required,
    application_deadline,
    status,
    created_by,
    created_at,
    updated_at
  from public.jobs j
  where is_client_member(client_id) or is_admin();

create view public.va_jobs_view
  with (security_invoker = false) as
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
  where is_admin() or (
    va_is_approved() and (
      status = 'OPEN'
      or exists (select 1 from public.job_applications ja where ja.job_id = j.id and ja.va_id = auth.uid())
      or exists (select 1 from public.placements p where p.job_id = j.id and p.va_id = auth.uid())
    )
  );

grant select on public.client_jobs_view to authenticated;
grant select on public.va_jobs_view to authenticated;
