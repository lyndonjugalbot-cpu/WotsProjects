-- Clients (company records), client_members (which profiles belong to which
-- client company), and projects.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  billing_email text,
  industry text,
  website text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clients is 'A company record. Multiple profiles (client_members) can belong to one client.';

-- One profile can belong to a client company; role_in_company distinguishes
-- who can manage billing/company settings (owner) vs. just view (member).
create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_company text not null default 'owner' check (role_in_company in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (client_id, profile_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Membership-check helpers, SECURITY DEFINER for the same recursive-RLS
-- reason as current_user_role() in the previous migration.
create or replace function public.is_client_member(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.client_members
    where client_id = target_client_id and profile_id = auth.uid()
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
      and profile_id = auth.uid()
      and role_in_company = 'owner'
  );
$$;

-- RLS ---------------------------------------------------------------------
-- Convention used from here on, across every table in this schema: one
-- "<table>_admin_all" FOR ALL policy grants admins full CRUD in a single
-- line, kept separate from the narrower member/owner/VA policies that
-- cover what non-admin roles can do.

alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.projects enable row level security;

create policy "clients_select_member" on public.clients
  for select using (public.is_client_member(id));

create policy "clients_update_owner" on public.clients
  for update using (public.is_client_owner(id));

create policy "clients_admin_all" on public.clients
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');

create policy "client_members_select_own" on public.client_members
  for select using (profile_id = auth.uid());

-- Only admin manages membership for now — self-service "invite a teammate"
-- is a later phase, not part of this schema pass.
create policy "client_members_admin_all" on public.client_members
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');

create policy "projects_select_member" on public.projects
  for select using (public.is_client_member(client_id));

-- NOTE: a "projects_select_va" policy (VA can see a project only if they
-- have an active placement on it) is added in the placements migration,
-- once the placements table this check depends on actually exists.

create policy "projects_write_owner" on public.projects
  for insert with check (public.is_client_owner(client_id));

create policy "projects_update_owner" on public.projects
  for update using (public.is_client_owner(client_id));

create policy "projects_admin_all" on public.projects
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');
