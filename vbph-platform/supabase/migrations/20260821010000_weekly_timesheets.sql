-- Weekly timesheets: one row per (placement, ISO week), carrying a review
-- status (OPEN -> SUBMITTED -> APPROVED -> LOCKED) and, once LOCKED, a
-- frozen snapshot of that week's Tracked/Approved/Rejected/Pending hours.
--
-- Two design decisions worth stating up front, since neither is obvious
-- from the columns alone:
--
-- 1. While a timesheet is OPEN/SUBMITTED/APPROVED, its hour totals are
--    NOT stored here at all (tracked_hours etc. stay NULL) -- the
--    application computes them live from time_segments/time_entries on
--    every read, the same way the existing Work Diary feature already
--    does ("Total Time is computed from segments... derived, not
--    stored" -- see docs/database.md). Storing a running total from the
--    start would mean keeping it in sync with every new segment, every
--    re-approval, every offline-queued segment that syncs late -- a
--    staleness bug waiting to happen, for numbers that are explicitly
--    allowed to keep changing right up until lock. The four hour
--    columns only ever become real the moment a timesheet is LOCKED
--    (enforced by timesheets_locked_has_snapshot below), at which point
--    they stop being a query result and become the historical record.
--
-- 2. There is deliberately NO plain UPDATE policy on this table, for
--    ANY role, admin included. The only two ways a timesheet's status or
--    hour columns can ever change are admin_set_timesheet_status() and
--    admin_correct_locked_timesheet() below -- both SECURITY DEFINER,
--    both write an audit_logs row in the same transaction as the change
--    they make. This is stricter than the column-GRANT pattern used
--    elsewhere in this schema (e.g. jobs.agency_margin, time_segments'
--    boundary columns) specifically because "any administrative
--    correction after locking must create an audit record" is a hard
--    requirement here, not a convention worth relying on a caller to
--    remember -- removing the UPDATE path entirely makes it structurally
--    impossible to change a locked week's numbers any other way.

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  week_start date not null,
  -- Generated, not just defaulted -- a timesheet's week is always exactly
  -- seven days (Monday through Sunday inclusive), the same invariant
  -- va_hourly_rate enforces for rates: not a rule the application has to
  -- remember, a shape Postgres won't allow to be wrong.
  week_end date generated always as (week_start + 6) stored not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'SUBMITTED', 'APPROVED', 'LOCKED')),
  -- NULL until LOCKED -- see note 1 above.
  tracked_hours numeric(8, 2) check (tracked_hours is null or tracked_hours >= 0),
  approved_hours numeric(8, 2) check (approved_hours is null or approved_hours >= 0),
  rejected_hours numeric(8, 2) check (rejected_hours is null or rejected_hours >= 0),
  pending_hours numeric(8, 2) check (pending_hours is null or pending_hours >= 0),
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  locked_at timestamptz,
  locked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One timesheet per placement per week -- also what makes "generate
  -- timesheets for this week" a safe upsert (ON CONFLICT DO NOTHING)
  -- rather than something that has to check-then-insert.
  constraint timesheets_placement_week_unique unique (placement_id, week_start),
  -- Weeks always start on Monday (ISO week, matching getWeekRange() /
  -- getStartOfIsoWeek() in application code -- see
  -- apps/web/src/lib/work-diary-date-range.ts).
  constraint timesheets_week_start_monday check (extract(dow from week_start) = 1),
  constraint timesheets_locked_has_snapshot check (
    status <> 'LOCKED'
    or (tracked_hours is not null and approved_hours is not null and rejected_hours is not null and pending_hours is not null)
  )
);

comment on table public.timesheets is
  'One row per (placement, ISO week). Hours are live-computed until LOCKED, then frozen -- see the migration header comment.';

create index timesheets_week_start_idx on public.timesheets (week_start);

create trigger timesheets_set_updated_at
  before update on public.timesheets
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
-- Read: admin (all), client (own placements' timesheets, hours only --
-- there is no rate/dollar column on this table at all, so "clients can
-- view tracked work but can't manipulate financial rate calculations" is
-- satisfied by construction: there is nothing rate-related here for a
-- client to even read, let alone write), VA (own placements' timesheets).
-- Write: see the header comment -- INSERT only (the generation step,
-- admin-only), no UPDATE policy at all, DELETE admin-only and only while
-- still OPEN (never let a LOCKED row's history disappear that way either).

-- Table-level grant, separate from and required in addition to the RLS
-- policies below (Postgres checks GRANTs before it ever evaluates RLS —
-- see fix_baseline_grants.sql for the same lesson learned earlier in this
-- project). Deliberately no UPDATE grant here at all, on top of there
-- being no UPDATE policy either: two independent reasons a plain UPDATE
-- can never reach this table, not one.
grant select, insert, delete on public.timesheets to authenticated;

alter table public.timesheets enable row level security;

create policy "timesheets_select_admin" on public.timesheets
  for select using (public.is_admin());

create policy "timesheets_select_client" on public.timesheets
  for select using (public.client_owns_placement(placement_id));

create policy "timesheets_select_va" on public.timesheets
  for select using (public.va_owns_placement(placement_id));

create policy "timesheets_insert_admin" on public.timesheets
  for insert with check (public.is_admin());

create policy "timesheets_delete_admin_unlocked" on public.timesheets
  for delete using (public.is_admin() and status <> 'LOCKED');

-- RPCs ------------------------------------------------------------------

-- Forward-only status transitions: OPEN -> SUBMITTED -> APPROVED -> LOCKED,
-- one step at a time, never backward, never skipped. Locking is the one
-- transition that also computes and stores the hour snapshot -- done
-- inside this same function/transaction so there's no window between
-- "compute the totals" and "persist them" where a concurrently-syncing
-- segment (the desktop app's offline queue, syncing something backlogged)
-- could land and make the stored snapshot not actually match what was
-- live at the instant of locking.
create or replace function public.admin_set_timesheet_status(
  target_timesheet_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current record;
  allowed_next text;
  v_tracked numeric;
  v_approved numeric;
  v_rejected numeric;
  v_pending numeric;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if new_status not in ('OPEN', 'SUBMITTED', 'APPROVED', 'LOCKED') then
    raise exception 'Invalid status: %', new_status;
  end if;

  select id, placement_id, week_start, status into current
    from public.timesheets where id = target_timesheet_id;
  if not found then
    raise exception 'Timesheet not found';
  end if;

  allowed_next := case current.status
    when 'OPEN' then 'SUBMITTED'
    when 'SUBMITTED' then 'APPROVED'
    when 'APPROVED' then 'LOCKED'
    else null
  end;

  if new_status is distinct from allowed_next then
    raise exception 'Cannot move a % timesheet to % -- the only allowed next status is %',
      current.status, new_status, coalesce(allowed_next, '(none, already LOCKED)');
  end if;

  if new_status = 'LOCKED' then
    -- segment_start is compared against explicit UTC instants (not a
    -- bare date::timestamptz cast, which would depend on the session's
    -- timezone setting) -- matches how every other week boundary in this
    -- app is computed, in UTC, regardless of server/session timezone.
    select
      coalesce(sum(extract(epoch from (s.segment_end - s.segment_start))), 0) / 3600.0,
      coalesce(sum(extract(epoch from (s.segment_end - s.segment_start))) filter (where e.status = 'approved'), 0) / 3600.0,
      coalesce(sum(extract(epoch from (s.segment_end - s.segment_start))) filter (where e.status = 'rejected'), 0) / 3600.0,
      coalesce(sum(extract(epoch from (s.segment_end - s.segment_start))) filter (where e.status = 'pending'), 0) / 3600.0
      into v_tracked, v_approved, v_rejected, v_pending
      from public.time_segments s
      join public.time_entries e on e.id = s.time_entry_id
      where e.placement_id = current.placement_id
        and s.segment_start >= (current.week_start::timestamp at time zone 'UTC')
        and s.segment_start < ((current.week_start + 7)::timestamp at time zone 'UTC');

    update public.timesheets
      set status = 'LOCKED',
          tracked_hours = round(v_tracked, 2),
          approved_hours = round(v_approved, 2),
          rejected_hours = round(v_rejected, 2),
          pending_hours = round(v_pending, 2),
          locked_at = now(),
          locked_by = auth.uid()
      where id = target_timesheet_id;
  elsif new_status = 'SUBMITTED' then
    update public.timesheets
      set status = 'SUBMITTED', submitted_at = now(), submitted_by = auth.uid()
      where id = target_timesheet_id;
  elsif new_status = 'APPROVED' then
    update public.timesheets
      set status = 'APPROVED', approved_at = now(), approved_by = auth.uid()
      where id = target_timesheet_id;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'timesheet_status_changed', 'timesheets', target_timesheet_id,
    jsonb_build_object(
      'from', current.status,
      'to', new_status,
      'snapshot', case when new_status = 'LOCKED' then jsonb_build_object(
        'tracked_hours', round(v_tracked, 2),
        'approved_hours', round(v_approved, 2),
        'rejected_hours', round(v_rejected, 2),
        'pending_hours', round(v_pending, 2)
      ) else null end
    )
  );
end;
$$;

-- The one, narrow, always-audited way a LOCKED timesheet's frozen hours
-- can ever change. Deliberately separate from admin_set_timesheet_status
-- (which only ever WRITES the snapshot once, at the lock transition
-- itself) -- this is the "administrative correction after locking" path
-- the requirement calls out by name, so it has its own function with its
-- own mandatory `reason`, rather than overloading the status-transition
-- function with an implicit "and also maybe re-lock with new numbers"
-- behavior that would be easy to trigger by accident.
create or replace function public.admin_correct_locked_timesheet(
  target_timesheet_id uuid,
  new_tracked_hours numeric,
  new_approved_hours numeric,
  new_rejected_hours numeric,
  new_pending_hours numeric,
  reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev record;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if reason is null or length(trim(reason)) = 0 then
    raise exception 'A reason is required to correct a locked timesheet';
  end if;

  if new_tracked_hours < 0 or new_approved_hours < 0 or new_rejected_hours < 0 or new_pending_hours < 0 then
    raise exception 'Hours cannot be negative';
  end if;

  select tracked_hours, approved_hours, rejected_hours, pending_hours, status into prev
    from public.timesheets where id = target_timesheet_id;
  if not found then
    raise exception 'Timesheet not found';
  end if;

  if prev.status <> 'LOCKED' then
    raise exception 'Only a LOCKED timesheet can be corrected this way -- use admin_set_timesheet_status for OPEN/SUBMITTED/APPROVED';
  end if;

  update public.timesheets
    set tracked_hours = new_tracked_hours,
        approved_hours = new_approved_hours,
        rejected_hours = new_rejected_hours,
        pending_hours = new_pending_hours
    where id = target_timesheet_id;

  -- Unconditional: every path through this function either raises
  -- (nothing changes) or reaches here (both the update above and this
  -- audit row commit together, in the same transaction). There is no
  -- way to take the update without this row also being written.
  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'timesheet_locked_correction', 'timesheets', target_timesheet_id,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'tracked_hours', prev.tracked_hours, 'approved_hours', prev.approved_hours,
        'rejected_hours', prev.rejected_hours, 'pending_hours', prev.pending_hours
      ),
      'new', jsonb_build_object(
        'tracked_hours', new_tracked_hours, 'approved_hours', new_approved_hours,
        'rejected_hours', new_rejected_hours, 'pending_hours', new_pending_hours
      ),
      'reason', reason
    )
  );
end;
$$;

-- "Allow admin to approve/reject questionable time" -- time_entries.status
-- and its approved_by/approved_at columns have existed since the original
-- time-tracking migration but nothing has ever written them (confirmed:
-- grepped the whole app, genuinely write-once-at-'pending' until now).
-- SECURITY DEFINER for the same reason as the two functions above, even
-- though admin's existing time_entries_admin_all policy would technically
-- allow a plain UPDATE here too -- routing it through one function that
-- always audit-logs means there's no plain-UPDATE code path for this
-- action to be added later that quietly skips the audit row.
create or replace function public.admin_set_time_entry_status(
  target_time_entry_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev record;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if new_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid status: %', new_status;
  end if;

  select status into prev from public.time_entries where id = target_time_entry_id;
  if not found then
    raise exception 'Time entry not found';
  end if;

  update public.time_entries
    set status = new_status,
        approved_by = case when new_status = 'pending' then null else auth.uid() end,
        approved_at = case when new_status = 'pending' then null else now() end
    where id = target_time_entry_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'time_entry_status_changed', 'time_entries', target_time_entry_id,
    jsonb_build_object('from', prev.status, 'to', new_status)
  );
end;
$$;

revoke all on function public.admin_set_timesheet_status(uuid, text) from public;
revoke all on function public.admin_correct_locked_timesheet(uuid, numeric, numeric, numeric, numeric, text) from public;
revoke all on function public.admin_set_time_entry_status(uuid, text) from public;
grant execute on function public.admin_set_timesheet_status(uuid, text) to authenticated;
grant execute on function public.admin_correct_locked_timesheet(uuid, numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.admin_set_time_entry_status(uuid, text) to authenticated;
