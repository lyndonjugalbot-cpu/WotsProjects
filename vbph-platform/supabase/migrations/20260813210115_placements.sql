-- Placements connect a client, a VA, (optionally) the job they were hired
-- through, and (optionally) a project. Rates are SNAPSHOTTED here at
-- placement time — deliberately NOT a live reference to jobs.client_hourly_rate
-- — so historical invoices/payroll stay correct even if the job posting's
-- rate changes later, and so admin can override the margin per-placement
-- without touching the original job.

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  va_id uuid not null references public.va_profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  client_hourly_rate numeric(10, 2) not null check (client_hourly_rate >= 0),
  agency_margin numeric(10, 2) not null check (agency_margin >= 0),
  va_hourly_rate numeric(10, 2)
    generated always as (client_hourly_rate - agency_margin) stored
    check (va_hourly_rate >= 0),
  hours_per_week_expected integer check (hours_per_week_expected is null or hours_per_week_expected > 0),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placements_end_after_start check (end_date is null or end_date >= start_date)
);

comment on table public.placements is
  'client/VA/job/project assignment. Rates are a snapshot at placement time, not a live reference to jobs.*.';

create trigger placements_set_updated_at
  before update on public.placements
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER helpers, same recursive-RLS reasoning as earlier
-- migrations. These are reused by time-tracking and invoicing RLS later.
create or replace function public.va_owns_placement(target_placement_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where id = target_placement_id and va_id = auth.uid()
  );
$$;

create or replace function public.client_owns_placement(target_placement_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- coalesce: see the identical comment on client_owns_job() — a
  -- non-matching id must resolve to false, not NULL.
  select coalesce(
    (select public.is_client_member(client_id) from public.placements where id = target_placement_id),
    false
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
    where project_id = target_project_id and va_id = auth.uid()
  );
$$;

-- RLS ---------------------------------------------------------------------
-- Same pattern as jobs: NO select policy for CLIENT or VA on the base
-- table (client_hourly_rate/agency_margin are sensitive) — reads go
-- through client_placements_view / va_placements_view added later.
-- Placement creation/management is admin-only (matches the architecture:
-- admins assign VAs to clients and manage placements, not self-service).

alter table public.placements enable row level security;

create policy "placements_admin_all" on public.placements
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');

-- Deferred from the clients/projects migration: now that placements
-- exists, a VA can see a project they're actually placed on.
create policy "projects_select_va" on public.projects
  for select using (public.va_has_placement_on_project(id));
