-- Weekly invoice engine: turns LOCKED timesheets into client invoices.
-- Invoice amount = Approved Billable Hours x Placement Client Hourly Rate,
-- per placement, generated from a client's LOCKED timesheets for one week.
--
-- Three things worth understanding before reading the rest of this file:
--
-- 1. PRECISION. "38 hours 20 minutes" is 38.3333... hours (repeating) --
--    the previous phase's timesheets.approved_hours (numeric(8,2)) rounds
--    that to 38.33, which multiplied by a $6.00 rate gives $229.98, NOT
--    the correct $230.00. That 2-decimal-place rounding was fine for a
--    human-readable weekly summary but is genuinely too lossy to bill
--    from. This migration widens every hours column that feeds a dollar
--    calculation to 4 decimal places (matching the precision the example
--    itself uses) and re-derives admin_set_timesheet_status()'s lock
--    snapshot at that precision. All of it stays in Postgres `numeric` —
--    exact decimal arithmetic -- never a JS/TS floating-point `number`
--    anywhere in the multiplication path. The application layer only
--    ever displays a dollar amount Postgres already computed; it never
--    recomputes hours * rate itself.
--
-- 2. IMMUTABILITY, same reasoning as timesheets. An invoice generated
--    from a locked week is itself a historical financial record — once
--    generated, its line items never change (no UPDATE path exists for
--    invoice_items at all, not even via RPC: the correction path is VOID
--    the invoice and regenerate, not edit it in place). The invoice's own
--    status lifecycle (DRAFT -> ISSUED -> PAID, or -> OVERDUE -> PAID, or
--    -> VOID) is the only thing that changes after generation, and only
--    through admin_set_invoice_status(), same "no UPDATE grant, no
--    UPDATE policy, RPC-only, self-audited" pattern as timesheets.
--
-- 3. PROFITABILITY IS RATE-SENSITIVE, same boundary as jobs/placements.
--    invoice_items.rate_hour (the CLIENT rate) was always meant to be
--    client-visible -- see the original invoicing migration's own
--    comment. This migration adds va_hourly_rate (a snapshot, same
--    reasoning as rate_hour itself being a snapshot rather than a live
--    join to placements) plus two generated columns
--    (va_payout_amount, margin_amount) so admin can see profitability
--    per line item. Those three columns get the exact same
--    column-GRANT treatment as jobs.agency_margin: structurally absent
--    from what a client session can even SELECT, not just filtered by a
--    view.

-- ── 1. Timesheet hour precision ─────────────────────────────────────────

alter table public.timesheets
  alter column tracked_hours type numeric(10, 4),
  alter column approved_hours type numeric(10, 4),
  alter column rejected_hours type numeric(10, 4),
  alter column pending_hours type numeric(10, 4);

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
    -- Rounded to 4 decimal places here -- and ONLY here, once, at the
    -- moment of freezing -- not re-rounded again downstream. The
    -- invoice engine below reads this stored value verbatim and
    -- multiplies it by the placement's rate in a single numeric
    -- expression; it never re-derives hours from segments itself.
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
          tracked_hours = round(v_tracked, 4),
          approved_hours = round(v_approved, 4),
          rejected_hours = round(v_rejected, 4),
          pending_hours = round(v_pending, 4),
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
        'tracked_hours', round(v_tracked, 4),
        'approved_hours', round(v_approved, 4),
        'rejected_hours', round(v_rejected, 4),
        'pending_hours', round(v_pending, 4)
      ) else null end
    )
  );
end;
$$;

-- ── 2. `invoices` status vocabulary + due_date ──────────────────────────
-- Same rename-and-widen dance as placements.status in the hiring_workflow
-- migration: uppercase every existing value, AND rename 'sent' -> 'ISSUED'
-- (the word itself changed, not just its case) to match this feature's
-- required vocabulary. No real invoice data exists yet anywhere this has
-- been applied, but this is still written as a real data migration, not
-- an assume-the-table-is-empty one.

update public.invoices set status = upper(status);
update public.invoices set status = 'ISSUED' where status = 'SENT';

alter table public.invoices alter column status drop default;
alter table public.invoices drop constraint invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID'));
alter table public.invoices alter column status set default 'DRAFT';

alter table public.invoices add column due_date date;

-- A client should only ever see an invoice that's actually been sent to
-- them -- a DRAFT is still a work-in-progress admin document. Replaces
-- the original invoicing migration's policy (which had no such
-- exclusion, because DRAFT didn't meaningfully exist as "not yet visible"
-- until this feature gave the status lifecycle a real first step).
drop policy "invoices_select_member" on public.invoices;
create policy "invoices_select_member" on public.invoices
  for select using (public.is_client_member(client_id) and status <> 'DRAFT');

-- No UPDATE policy or grant on `invoices` at all -- same reasoning as
-- `timesheets`: admin_set_invoice_status() is SECURITY DEFINER and is
-- the only thing that can ever change status/issued_at/paid_at, and it
-- always audit-logs in the same transaction. INSERT is revoked too --
-- every invoice is created by admin_generate_weekly_invoice(), which
-- guarantees the invoice_number sequence and line items are created
-- together, atomically; there is no path to a hand-crafted, inconsistent
-- invoice row.
revoke insert, update on public.invoices from authenticated;

drop policy "invoices_admin_all" on public.invoices;
create policy "invoices_select_admin" on public.invoices
  for select using (public.is_admin());
-- DELETE stays admin-only and DRAFT-only -- once issued, an invoice
-- number should never just disappear (gaps/reuse in a sequence a client
-- may already have seen are bad invoicing hygiene); VOID is the only way
-- to invalidate an invoice past DRAFT.
create policy "invoices_delete_admin_draft" on public.invoices
  for delete using (public.is_admin() and status = 'DRAFT');

-- ── 3. `invoice_items`: wider hours, VA-rate snapshot + profitability ──

-- `amount` is GENERATED from `hours` -- Postgres won't let you ALTER the
-- type of a column a generated column depends on while that dependency
-- exists, so it's dropped and re-added around the width change.
alter table public.invoice_items drop column amount;
alter table public.invoice_items alter column hours type numeric(6, 4);
alter table public.invoice_items add column amount numeric(12, 2) generated always as (hours * rate_hour) stored;

alter table public.invoice_items
  add column va_hourly_rate numeric(10, 2) check (va_hourly_rate is null or va_hourly_rate >= 0),
  -- Snapshots, not live joins to placements -- same reasoning as
  -- rate_hour already being a snapshot rather than a reference to
  -- placements.client_hourly_rate: a later admin rate override on the
  -- placement must never retroactively change what an already-generated
  -- invoice reports, for either the client-visible amount OR the
  -- admin-only profitability figures.
  add column va_payout_amount numeric(12, 2) generated always as (hours * va_hourly_rate) stored,
  add column margin_amount numeric(12, 2) generated always as (hours * (rate_hour - va_hourly_rate)) stored;

comment on column public.invoice_items.va_payout_amount is 'Admin-only. What the VA is paid for this line item -- see the column-GRANT restriction below.';
comment on column public.invoice_items.margin_amount is 'Admin-only. Agency profit on this line item (amount - va_payout_amount, by construction).';

-- No UPDATE/DELETE/INSERT policy or grant for anyone -- invoice_items are
-- created ONLY by admin_generate_weekly_invoice() (SECURITY DEFINER,
-- bypasses this entirely) and are never edited afterward. A correction
-- means VOID the invoice and regenerate, not editing a line item in
-- place -- see the migration header comment.
revoke insert, update, delete on public.invoice_items from authenticated;

drop policy "invoice_items_admin_all" on public.invoice_items;
create policy "invoice_items_select_admin" on public.invoice_items
  for select using (public.is_admin());

-- Column-level grant narrows the existing broad SELECT (from
-- fix_baseline_grants.sql) down to exactly the client-safe columns --
-- same recipe as jobs.agency_margin. A client's own RLS-scoped session
-- querying va_hourly_rate/va_payout_amount/margin_amount directly against
-- the base table now gets `permission denied for table invoice_items`,
-- not merely a value a view happened not to include.
revoke select on public.invoice_items from authenticated;
grant select (id, invoice_id, placement_id, time_entry_id, description, hours, rate_hour, amount, created_at)
  on public.invoice_items to authenticated;

-- Admin still needs every column, including the three rate-sensitive
-- ones the grant above deliberately excludes -- same view-bypasses-grants
-- mechanism as admin_placements_view (the view owner is exempt from RLS
-- AND from the column grant, since Postgres never applies either to a
-- relation's owner).
create view public.admin_invoice_items_view
  with (security_invoker = false) as
  select
    id, invoice_id, placement_id, time_entry_id, description,
    hours, rate_hour, amount, va_hourly_rate, va_payout_amount, margin_amount,
    created_at
  from public.invoice_items
  where is_admin();

grant select on public.admin_invoice_items_view to authenticated;

-- ── 4. Invoice numbering ────────────────────────────────────────────────
-- A real Postgres sequence, not a max()+1 or client-side counter --
-- collision-proof under concurrent generation. Only ever touched from
-- inside admin_generate_weekly_invoice() (SECURITY DEFINER), so it needs
-- no grant of its own to `authenticated`.
create sequence public.invoice_number_seq;

-- ── 5. The engine ────────────────────────────────────────────────────────
-- Approved Billable Hours x Placement Client Hourly Rate, per placement,
-- for every LOCKED timesheet a client's placements have for one week.
-- One invoice per (client, week) -- enforced by a real unique constraint,
-- not just an RPC-level check, so a race between two concurrent
-- generation attempts can't produce two invoices for the same period.
alter table public.invoices
  add constraint invoices_client_period_unique unique (client_id, period_start);

create or replace function public.admin_generate_weekly_invoice(
  target_client_id uuid,
  target_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_invoice_id uuid;
  new_invoice_number text;
  running_subtotal numeric(12, 2) := 0;
  line_item_count integer := 0;
  rec record;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if extract(dow from target_week_start) <> 1 then
    raise exception 'target_week_start must be a Monday';
  end if;

  if exists (select 1 from public.invoices where client_id = target_client_id and period_start = target_week_start) then
    raise exception 'An invoice already exists for this client and week';
  end if;

  new_invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');

  new_invoice_id := gen_random_uuid();
  insert into public.invoices (
    id, client_id, invoice_number, period_start, period_end,
    subtotal, total, status, due_date
  ) values (
    new_invoice_id, target_client_id, new_invoice_number, target_week_start, target_week_start + 6,
    0, 0, 'DRAFT', current_date + 15
  );

  -- Every LOCKED timesheet, for every one of this client's placements,
  -- for exactly this week -- Approved Hours is read verbatim from the
  -- frozen snapshot (never re-derived from segments here), matching the
  -- whole reason locking exists: what gets billed is what was frozen,
  -- not whatever segments happen to say right now.
  for rec in
    select
      t.id as timesheet_id,
      t.placement_id,
      t.approved_hours,
      p.va_id,
      p.client_hourly_rate,
      p.va_hourly_rate
    from public.timesheets t
    join public.placements p on p.id = t.placement_id
    where p.client_id = target_client_id
      and t.week_start = target_week_start
      and t.status = 'LOCKED'
      and t.approved_hours > 0
  loop
    insert into public.invoice_items (
      invoice_id, placement_id, description, hours, rate_hour, va_hourly_rate
    ) values (
      new_invoice_id, rec.placement_id,
      'Week of ' || to_char(target_week_start, 'YYYY-MM-DD'),
      rec.approved_hours, rec.client_hourly_rate, rec.va_hourly_rate
    );
    running_subtotal := running_subtotal + round(rec.approved_hours * rec.client_hourly_rate, 2);
    line_item_count := line_item_count + 1;
  end loop;

  if line_item_count = 0 then
    -- Roll back the whole invoice, not just skip creating line items --
    -- an invoice with zero lines is not a real invoice. Raising inside a
    -- plpgsql function aborts the entire transaction, including the
    -- INSERT into invoices above.
    raise exception 'No LOCKED timesheets with approved hours found for this client and week';
  end if;

  update public.invoices set subtotal = running_subtotal, total = running_subtotal where id = new_invoice_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'invoice_generated', 'invoices', new_invoice_id,
    jsonb_build_object(
      'client_id', target_client_id, 'week_start', target_week_start,
      'line_item_count', line_item_count, 'total', running_subtotal
    )
  );

  return new_invoice_id;
end;
$$;

-- Explicit allowed-transition pairs, not a single-successor chain like
-- timesheets -- an invoice's lifecycle genuinely branches (ISSUED can go
-- to PAID, OVERDUE, or VOID). issued_at/paid_at are stamped exactly once,
-- on the transition that makes them true, never touched otherwise.
create or replace function public.admin_set_invoice_status(
  target_invoice_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  transition_allowed boolean;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if new_status not in ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID') then
    raise exception 'Invalid status: %', new_status;
  end if;

  select status into current_status from public.invoices where id = target_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;

  transition_allowed := (current_status, new_status) in (
    ('DRAFT', 'ISSUED'), ('DRAFT', 'VOID'),
    ('ISSUED', 'PAID'), ('ISSUED', 'OVERDUE'), ('ISSUED', 'VOID'),
    ('OVERDUE', 'PAID'), ('OVERDUE', 'VOID')
  );
  if not transition_allowed then
    raise exception 'Cannot move an invoice from % to %', current_status, new_status;
  end if;

  update public.invoices
    set status = new_status,
        issued_at = case when new_status = 'ISSUED' then now() else issued_at end,
        paid_at = case when new_status = 'PAID' then now() else paid_at end
    where id = target_invoice_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(), 'invoice_status_changed', 'invoices', target_invoice_id,
    jsonb_build_object('from', current_status, 'to', new_status)
  );
end;
$$;

revoke all on function public.admin_generate_weekly_invoice(uuid, date) from public;
revoke all on function public.admin_set_invoice_status(uuid, text) from public;
grant execute on function public.admin_generate_weekly_invoice(uuid, date) to authenticated;
grant execute on function public.admin_set_invoice_status(uuid, text) to authenticated;
