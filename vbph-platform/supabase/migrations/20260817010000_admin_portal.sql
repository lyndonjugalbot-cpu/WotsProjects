-- Admin Portal: fixes two real privilege-escalation gaps found while
-- building it, then adds the admin-only rate visibility and rate-override
-- machinery the portal needs.

-- ── Gap 1: a client/VA could self-promote to ADMIN ──────────────────────
-- profiles_update_own's WITH CHECK is only `id = auth.uid()` — it never
-- scrutinizes which columns changed. Column-level GRANTs can't fix this
-- either: CLIENT/VA/ADMIN are all the same Postgres role (`authenticated`),
-- so a grant broad enough for a user to edit their own full_name is
-- automatically broad enough for them to attempt writing role/status too.
-- Confirmed empirically before this fix: as a CLIENT,
--   update profiles set role = 'ADMIN' where id = auth.uid();
-- succeeded. A BEFORE UPDATE trigger is the right tool here — unlike RLS
-- policies, it has direct OLD/NEW access and runs regardless of which
-- policy admitted the UPDATE.
-- `auth.uid() is null` is the escape hatch for trusted, non-session
-- contexts — seed.sql's direct `update profiles set role = 'ADMIN'`
-- bootstrapping, migrations, and the service-role client all run with no
-- JWT claims at all, same as handle_new_user()'s own note that "admin
-- accounts are created only via direct, service-role database access".
-- Any request arriving with a real end-user session (auth.uid() present)
-- must pass is_admin() to touch these columns.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and auth.uid() is not null
     and not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can change role or status.';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_self_privilege_escalation();

-- ── Gap 2: a VA could self-approve their own application ────────────────
-- Same shape, same fix. va_profiles_update_own has the identical
-- `id = auth.uid()`-only WITH CHECK. Confirmed empirically: as a pending
-- VA, `update va_profiles set approval_status = 'approved' where id =
-- auth.uid()` succeeded.
create or replace function public.prevent_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.approval_status is distinct from old.approval_status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.rejection_reason is distinct from old.rejection_reason
  ) and auth.uid() is not null
    and not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can change VA approval status.';
  end if;
  return new;
end;
$$;

create trigger va_profiles_prevent_self_approval
  before update on public.va_profiles
  for each row
  execute function public.prevent_self_approval();

-- ── Admin-only rate-visible views ────────────────────────────────────────
-- Every other view in this schema deliberately hides either the client
-- rate or the VA rate (see docs/database.md). The Admin Portal is the one
-- place all three (client rate, VA rate, margin) may be shown together —
-- these views exist only for that, and return zero rows for anyone but
-- an admin (`where is_admin()`, no OR clause for client/VA membership).

create view public.admin_jobs_view
  with (security_invoker = false) as
  select
    id, client_id, title, description, responsibilities, required_skills,
    experience_level, hours_per_week, timezone, schedule,
    client_hourly_rate, agency_margin, va_hourly_rate,
    num_vas_required, application_deadline, status, created_by,
    created_at, updated_at
  from public.jobs
  where is_admin();

create view public.admin_placements_view
  with (security_invoker = false) as
  select
    id, client_id, va_id, job_id, project_id,
    client_hourly_rate, agency_margin, va_hourly_rate,
    hours_per_week_expected, start_date, end_date, status,
    created_at, updated_at
  from public.placements
  where is_admin();

grant select on public.admin_jobs_view to authenticated;
grant select on public.admin_placements_view to authenticated;

-- ── Rate-override RPCs ───────────────────────────────────────────────────
-- "Client rate, VA rate, and margin must remain mathematically
-- consistent" is enforced by construction, not by validation: margin is
-- always computed server-side as client_rate - va_rate and both target
-- columns are written in the same statement that also writes the
-- generated va_hourly_rate's inputs — there is no code path where a
-- caller supplies margin directly and it could drift from the other two.
-- SECURITY DEFINER + explicit is_admin() check (not just RLS) for the
-- same reason as delete_screenshot() in the time-tracking migration:
-- this needs to write agency_margin, which no role has a column grant
-- for at all (see job_posting_fields migration) — a plain UPDATE from
-- any session, admin included, would fail on the grant check before RLS
-- even runs. Each call writes an audit_logs row itself, so the caller
-- can't forget to.

create or replace function public.admin_update_job_rates(
  target_job_id uuid,
  new_client_hourly_rate numeric,
  new_va_hourly_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_margin numeric;
  prev record;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  select client_hourly_rate, agency_margin, va_hourly_rate into prev
    from public.jobs where id = target_job_id;
  if not found then
    raise exception 'Job not found';
  end if;

  computed_margin := new_client_hourly_rate - new_va_hourly_rate;

  update public.jobs
    set client_hourly_rate = new_client_hourly_rate,
        agency_margin = computed_margin
    where id = target_job_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'job_rates_updated', 'jobs', target_job_id,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'client_hourly_rate', prev.client_hourly_rate,
        'agency_margin', prev.agency_margin,
        'va_hourly_rate', prev.va_hourly_rate
      ),
      'new', jsonb_build_object(
        'client_hourly_rate', new_client_hourly_rate,
        'agency_margin', computed_margin,
        'va_hourly_rate', new_va_hourly_rate
      )
    )
  );
end;
$$;

create or replace function public.admin_update_placement_rates(
  target_placement_id uuid,
  new_client_hourly_rate numeric,
  new_va_hourly_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_margin numeric;
  prev record;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  select client_hourly_rate, agency_margin, va_hourly_rate into prev
    from public.placements where id = target_placement_id;
  if not found then
    raise exception 'Placement not found';
  end if;

  computed_margin := new_client_hourly_rate - new_va_hourly_rate;

  update public.placements
    set client_hourly_rate = new_client_hourly_rate,
        agency_margin = computed_margin
    where id = target_placement_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'placement_rates_updated', 'placements', target_placement_id,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'client_hourly_rate', prev.client_hourly_rate,
        'agency_margin', prev.agency_margin,
        'va_hourly_rate', prev.va_hourly_rate
      ),
      'new', jsonb_build_object(
        'client_hourly_rate', new_client_hourly_rate,
        'agency_margin', computed_margin,
        'va_hourly_rate', new_va_hourly_rate
      )
    )
  );
end;
$$;

revoke all on function public.admin_update_job_rates(uuid, numeric, numeric) from public;
revoke all on function public.admin_update_placement_rates(uuid, numeric, numeric) from public;
grant execute on function public.admin_update_job_rates(uuid, numeric, numeric) to authenticated;
grant execute on function public.admin_update_placement_rates(uuid, numeric, numeric) to authenticated;
