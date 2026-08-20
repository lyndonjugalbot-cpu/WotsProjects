-- Time tracking: time_entries (a timer session), time_segments (the
-- 10-minute increments within a session — the atomic tracked/billed unit),
-- and screenshots (one per segment).
--
-- Deliberately no `va_id` column on any of these — it would just be a copy
-- of placements.va_id with a real risk of drifting out of sync. Ownership
-- is always resolved through the placement_id chain via the SECURITY
-- DEFINER helpers below, which is a cheap indexed lookup, not a real cost.

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_end_after_start check (ended_at is null or ended_at >= started_at)
);

create table public.time_segments (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries (id) on delete cascade,
  segment_start timestamptz not null,
  segment_end timestamptz not null,
  activity_percentage smallint check (activity_percentage is null or activity_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  constraint time_segments_end_after_start check (segment_end > segment_start),
  -- The whole billing model assumes 10-minute atomic units — guard it here,
  -- not just in application code.
  constraint time_segments_max_ten_minutes check (segment_end - segment_start <= interval '10 minutes')
);

create table public.screenshots (
  id uuid primary key default gen_random_uuid(),
  time_segment_id uuid not null unique references public.time_segments (id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.screenshots is
  'One per time_segment (enforced by the unique FK). Delete via public.delete_screenshot(), not a direct DELETE — see below.';

create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- Ownership helpers, chained through placements' own helpers -------------

-- All four below coalesce to false on a non-matching id, same reasoning as
-- client_owns_job()/client_owns_placement() — safe for both RLS and plpgsql callers.

create or replace function public.va_owns_time_entry(target_time_entry_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select public.va_owns_placement(placement_id) from public.time_entries where id = target_time_entry_id),
    false
  );
$$;

create or replace function public.client_owns_time_entry(target_time_entry_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select public.client_owns_placement(placement_id) from public.time_entries where id = target_time_entry_id),
    false
  );
$$;

create or replace function public.va_owns_time_segment(target_time_segment_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select public.va_owns_time_entry(time_entry_id) from public.time_segments where id = target_time_segment_id),
    false
  );
$$;

create or replace function public.client_owns_time_segment(target_time_segment_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select public.client_owns_time_entry(time_entry_id) from public.time_segments where id = target_time_segment_id),
    false
  );
$$;

-- Atomic, authorized screenshot deletion -----------------------------------
-- "Delete a screenshot" is implemented as "delete its time_segment" — the
-- screenshots.time_segment_id FK is ON DELETE CASCADE, so removing the
-- segment removes the screenshot row as a side effect in the same
-- transaction. VAs have no direct DELETE policy on either table — this
-- function (with its own ownership check) is their only deletion path, so
-- the app should always call it rather than issuing a raw DELETE. Admins
-- retain direct DELETE via their FOR ALL policy below; an admin deleting a
-- screenshots row directly (bypassing this function) would orphan the
-- time_segment instead of removing it — acceptable for a trusted admin
-- action, but worth knowing if you're calling this from the admin portal too.
--
-- NOTE: this only removes the database rows. The caller is still
-- responsible for removing the actual file from Storage (e.g. via the
-- Supabase Storage SDK's .remove()) — deleting storage.objects directly
-- from SQL isn't a safe substitute for that API call.
create or replace function public.delete_screenshot(target_screenshot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_time_segment_id uuid;
  v_placement_id uuid;
begin
  select ts.id, te.placement_id
  into v_time_segment_id, v_placement_id
  from public.screenshots s
  join public.time_segments ts on ts.id = s.time_segment_id
  join public.time_entries te on te.id = ts.time_entry_id
  where s.id = target_screenshot_id;

  if v_time_segment_id is null then
    raise exception 'Screenshot not found';
  end if;

  if not (coalesce(public.va_owns_placement(v_placement_id), false) or public.is_admin()) then
    raise exception 'Not authorized to delete this screenshot';
  end if;

  delete from public.time_segments where id = v_time_segment_id;
end;
$$;

-- RLS ---------------------------------------------------------------------

alter table public.time_entries enable row level security;
alter table public.time_segments enable row level security;
alter table public.screenshots enable row level security;

create policy "time_entries_select_va" on public.time_entries
  for select using (public.va_owns_placement(placement_id));

create policy "time_entries_select_client" on public.time_entries
  for select using (public.client_owns_placement(placement_id));

create policy "time_entries_insert_va" on public.time_entries
  for insert with check (public.va_owns_placement(placement_id));

-- VA can only edit their own entry while it's still pending — once admin
-- approves/rejects it, it's locked from further VA edits.
create policy "time_entries_update_va_pending" on public.time_entries
  for update
  using (public.va_owns_placement(placement_id) and status = 'pending')
  with check (public.va_owns_placement(placement_id) and status = 'pending');

create policy "time_entries_admin_all" on public.time_entries
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');

create policy "time_segments_select_va" on public.time_segments
  for select using (public.va_owns_time_entry(time_entry_id));

create policy "time_segments_select_client" on public.time_segments
  for select using (public.client_owns_time_entry(time_entry_id));

create policy "time_segments_insert_va" on public.time_segments
  for insert with check (public.va_owns_time_entry(time_entry_id));

create policy "time_segments_admin_all" on public.time_segments
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');

create policy "screenshots_select_va" on public.screenshots
  for select using (public.va_owns_time_segment(time_segment_id));

create policy "screenshots_select_client" on public.screenshots
  for select using (public.client_owns_time_segment(time_segment_id));

create policy "screenshots_insert_va" on public.screenshots
  for insert with check (public.va_owns_time_segment(time_segment_id));

create policy "screenshots_admin_all" on public.screenshots
  for all using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');
