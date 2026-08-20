-- Jobs and job applications.
--
-- RATE PRIVACY — the most important design constraint in this file:
--   * va_hourly_rate is a GENERATED column (client_hourly_rate - agency_margin).
--     It is IMPOSSIBLE to insert or update it directly — Postgres rejects any
--     attempt to write to a GENERATED ALWAYS column — so "don't depend on
--     JavaScript to compute the VA rate" is enforced at the schema level,
--     not just by convention in application code.
--   * A CHECK constraint on that generated column makes a negative VA rate
--     (margin larger than the client rate) impossible to persist, full stop.
--   * The base `jobs` table has NO select policy for 'CLIENT' or 'VA' at
--     all — only 'ADMIN'. Client- and VA-facing reads go exclusively through
--     client_jobs_view / va_jobs_view (added once job_applications and
--     placements exist, in a later migration), which expose only the
--     columns each role is allowed to see. This is not optional column
--     hiding — it is the only read path those roles have to this table.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  description text,
  requirements text,
  hours_per_week integer check (hours_per_week is null or hours_per_week > 0),
  timezone text,
  schedule text,
  client_hourly_rate numeric(10, 2) not null check (client_hourly_rate >= 0),
  agency_margin numeric(10, 2) not null default 2.00 check (agency_margin >= 0),
  va_hourly_rate numeric(10, 2)
    generated always as (client_hourly_rate - agency_margin) stored
    check (va_hourly_rate >= 0),
  status text not null default 'draft' check (status in ('draft', 'open', 'filled', 'closed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.jobs.va_hourly_rate is
  'GENERATED, never written directly. client_hourly_rate - agency_margin, enforced >= 0 by CHECK.';

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  va_id uuid not null references public.va_profiles (id) on delete cascade,
  cover_note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'rejected', 'withdrawn', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, va_id)
);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create trigger job_applications_set_updated_at
  before update on public.job_applications
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER so this can check job ownership even though the calling
-- role (client) has no direct SELECT grant on the jobs table itself.
create or replace function public.client_owns_job(target_job_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- coalesce: a non-matching target_job_id must read as "not owned", not
  -- NULL — NULL is safe inside RLS (denies) but not if this is ever called
  -- from plpgsql `if not (...)` logic, where `not null` is null, not true.
  select coalesce(
    (select public.is_client_member(client_id) from public.jobs where id = target_job_id),
    false
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
    where id = auth.uid() and approval_status = 'approved'
  );
$$;

-- RLS ---------------------------------------------------------------------

alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;

-- No SELECT policy for CLIENT or VA here — intentional. See file header.

create policy "jobs_insert_owner" on public.jobs
  for insert with check (public.is_client_owner(client_id));

create policy "jobs_update_owner" on public.jobs
  for update using (public.is_client_owner(client_id));

create policy "jobs_admin_all" on public.jobs
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');

create policy "job_applications_select_own_va" on public.job_applications
  for select using (va_id = auth.uid());

create policy "job_applications_select_client" on public.job_applications
  for select using (public.client_owns_job(job_id));

create policy "job_applications_insert_approved_va" on public.job_applications
  for insert with check (va_id = auth.uid() and public.va_is_approved());

-- A VA may only update their own application, and only to withdraw it —
-- shortlisting/rejecting/accepting are admin (or later, client) actions.
create policy "job_applications_withdraw_own" on public.job_applications
  for update
  using (va_id = auth.uid())
  with check (va_id = auth.uid() and status = 'withdrawn');

create policy "job_applications_admin_all" on public.job_applications
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');
