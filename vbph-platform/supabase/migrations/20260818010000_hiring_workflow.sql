-- Hiring/placement workflow: placements gain a PENDING status ("hired,
-- not yet started") ahead of ACTIVE, matching the real lifecycle —
-- Application HIRED -> Placement created (PENDING) -> Placement activated
-- (ACTIVE) -> visible to client/VA -> eventually ENDED.

update public.placements set status = upper(status);

alter table public.placements alter column status drop default;

alter table public.placements drop constraint placements_status_check;
alter table public.placements add constraint placements_status_check
  check (status in ('PENDING', 'ACTIVE', 'PAUSED', 'ENDED'));

alter table public.placements alter column status set default 'PENDING';

-- ── VA visibility into their own placement's client ─────────────────────
-- "After activation, the VA sees the assigned client/project under their
-- dashboard" needs the VA to read the client's company_name. `projects`
-- already has this for the VA side (projects_select_va, via
-- va_has_placement_on_project) — `clients` never got the equivalent.
-- Confirmed empirically before this fix: a VA with an active placement at
-- Acme Corp got 0 rows querying `clients` for Acme's company_name, while
-- the same VA could already read the linked project's name fine.
create or replace function public.va_has_placement_with_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where client_id = target_client_id and va_id = auth.uid()
  );
$$;

create policy clients_select_va on public.clients
  for select
  using (va_has_placement_with_client(id));

-- ── Placement status updates were silently broken ────────────────────────
-- `placements` has SELECT fully revoked from `authenticated` (same
-- rate-privacy grant pattern as `jobs`), but an `UPDATE ... WHERE id = ?`
-- still needs column-level SELECT on `id` to evaluate that WHERE clause —
-- a Postgres privilege check independent of RLS (the exact gap documented
-- for `jobs` in docs/database.md). Confirmed empirically: as admin,
-- `update placements set status = 'ACTIVE' where id = ...` failed with
-- `permission denied for table placements`, not an RLS rejection —
-- updatePlacementStatusAction has been non-functional since the Admin
-- Portal phase, only now caught by actually driving a status transition
-- through the UI.
--
-- Unlike `jobs`, `placements` has exactly one applicable policy
-- (`placements_admin_all`, admin-only, no client/VA policy at all) — so a
-- broad SELECT grant here is safe by the same reasoning as audit_logs and
-- application_admin_notes: RLS alone already returns zero rows for any
-- non-admin regardless of what's granted at the column level, so there is
-- no separate column-scoping concern the way there was for `jobs`.
grant select on public.placements to authenticated;
