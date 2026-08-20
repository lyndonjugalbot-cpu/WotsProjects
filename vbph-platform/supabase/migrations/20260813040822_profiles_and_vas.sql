-- Phase 1/2: profiles, va_profiles, and the auth.users -> profiles trigger.
--
-- Design notes:
--   * `profiles.role` is the single source of truth for app-level role.
--     It is NEVER trusted from the client — only ever read server-side.
--   * A user can self-assign 'CLIENT' or 'VA' at signup (via user_metadata),
--     but NEVER 'ADMIN'. The trigger below hardcodes this — there is no
--     code path where raw_user_meta_data can produce an admin account.
--   * RLS lets a user read/update their OWN row, but the `role`/`status`
--     columns are protected by column-level GRANTs (see bottom of file) so
--     a user cannot escalate their own privileges even though the row-level
--     policy would otherwise allow the UPDATE to go through.

create type public.user_role as enum ('CLIENT', 'VA', 'ADMIN');
create type public.account_status as enum ('active', 'suspended');
create type public.va_approval_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'CLIENT',
  full_name text,
  avatar_url text,
  phone text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Source of truth for app-level role.';

-- Extended VA profile. approval_status gates marketplace/placement access —
-- a VA can complete this profile before approval, but cannot see jobs,
-- apply, or be placed until an admin approves them (enforced in the
-- jobs/placements migrations' RLS, not here).
create table public.va_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  headline text,
  bio text,
  skills text[] not null default '{}',
  experience_years integer check (experience_years is null or experience_years >= 0),
  timezone text,
  resume_url text,
  portfolio_url text,
  approval_status public.va_approval_status not null default 'pending',
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.va_profiles is 'Extended VA record. approval_status gates marketplace/placement access.';

-- updated_at maintenance ------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger va_profiles_set_updated_at
  before update on public.va_profiles
  for each row execute function public.set_updated_at();

-- auth.users -> profiles (+ va_profiles) trigger -------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  resolved_role public.user_role;
begin
  -- Self-signup can only ever produce 'CLIENT' or 'VA'. Any other value
  -- (including 'ADMIN') silently falls back to 'CLIENT' — admin accounts
  -- are created only via direct, service-role database access.
  if requested_role = 'VA' then
    resolved_role := 'VA';
  else
    resolved_role := 'CLIENT';
  end if;

  insert into public.profiles (id, role, full_name)
  values (new.id, resolved_role, new.raw_user_meta_data ->> 'full_name');

  if resolved_role = 'VA' then
    insert into public.va_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role-check helper (SECURITY DEFINER, owned by the migration role, which
-- bypasses RLS on profiles — this is what lets policies below check "is the
-- current user an admin?" without recursively triggering profiles' own RLS) --

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- NULL-safe wrapper around `current_user_role() = 'ADMIN'`. That raw
-- comparison is fine inside RLS (NULL denies the row, same as false) but is
-- a bug trap in plpgsql `if not (...)` logic — `not null` is null, not
-- true, so an exception guarded that way silently fails to fire for a
-- caller with no profiles row. Use this in every plpgsql function from
-- here on instead of the raw comparison.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'ADMIN', false);
$$;

-- RLS ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.va_profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_admin" on public.profiles
  for select using (public.current_user_role() = 'ADMIN');

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update using (public.current_user_role() = 'ADMIN');

create policy "va_profiles_select_own" on public.va_profiles
  for select using (id = auth.uid());

create policy "va_profiles_select_admin" on public.va_profiles
  for select using (public.current_user_role() = 'ADMIN');

create policy "va_profiles_update_own" on public.va_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "va_profiles_update_admin" on public.va_profiles
  for update using (public.current_user_role() = 'ADMIN');

-- Column-level privilege restriction ---------------------------------------
-- RLS is row-level only. Without this, "update own" above would let a user
-- PATCH their own `role`/`status` (profiles) or `approval_status`/
-- `approved_by`/`approved_at`/`rejection_reason` (va_profiles) — i.e.
-- self-approve or self-promote to admin. Revoke the broad grant, then grant
-- back only the columns a non-admin should be able to touch on their own row.

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, phone) on public.profiles to authenticated;

revoke update on public.va_profiles from authenticated;
grant update (headline, bio, skills, experience_years, timezone, resume_url, portfolio_url)
  on public.va_profiles to authenticated;
-- approval_status and friends are admin-only, always, via the
-- "va_profiles_update_admin" policy + the admin role's privileges.
