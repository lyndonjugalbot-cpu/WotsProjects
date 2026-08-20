-- Time-Tracking Backend: activity aggregates (never raw input), a private
-- screenshot bucket, and the RLS a VA needs to record activity on their
-- own in-progress segment.
--
-- What is deliberately NOT captured anywhere in this schema, by design:
-- actual keystrokes, passwords, clipboard contents, URLs, or message
-- contents. `keyboard_activity_count`/`mouse_activity_count` are plain
-- counters (how many input events happened), never the events themselves.
-- If a future phase needs URL tracking, that's a new, explicit column and
-- a new conversation about what's being collected and why — not an
-- implicit extension of this one.

alter table public.time_segments
  add column keyboard_activity_count integer check (keyboard_activity_count is null or keyboard_activity_count >= 0),
  add column mouse_activity_count integer check (mouse_activity_count is null or mouse_activity_count >= 0),
  add column memo text;

-- ── VA can record/update activity on their own segment ──────────────────
-- time_segments previously had SELECT (VA/client) and INSERT (VA) but no
-- UPDATE policy at all — "Record Activity" (updating an already-created
-- segment's counts) had no path. segment_start/segment_end/time_entry_id
-- must stay immutable after creation — those are the billable-time
-- boundaries; if a VA could edit them post-hoc they could fraudulently
-- extend tracked time. RLS can't express "this row is editable but only
-- these columns" (a WITH CHECK only sees the new row, not which columns
-- changed) — same reasoning as the jobs.agency_margin column grant — so
-- the boundary here is a column-level GRANT, not the policy.
create policy time_segments_update_va on public.time_segments
  for update
  using (va_owns_time_entry(time_entry_id))
  with check (va_owns_time_entry(time_entry_id));

revoke update on public.time_segments from authenticated;
grant update (keyboard_activity_count, mouse_activity_count, activity_percentage, memo)
  on public.time_segments to authenticated;

-- time_segments has no SELECT grant gap to worry about here (unlike
-- jobs/placements) — it was never part of the rate-privacy revoke, so the
-- UPDATE ... WHERE clause's read of id/time_entry_id is already covered
-- by the table's existing broad SELECT grant.

-- ── delete_screenshot() now also hands back the storage path ────────────
-- Previously returned void and only removed the DB rows — the caller was
-- "responsible for removing the actual file via the Storage SDK" with no
-- way to know what that file was without a query racing the delete.
-- Returning the path lets the Route Handler delete the Storage object in
-- the same request, after the authorization-checked DB delete succeeds.
drop function if exists public.delete_screenshot(uuid);

create function public.delete_screenshot(target_screenshot_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_time_segment_id uuid;
  v_placement_id uuid;
  v_storage_path text;
begin
  select ts.id, te.placement_id, s.storage_path
  into v_time_segment_id, v_placement_id, v_storage_path
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

  return v_storage_path;
end;
$$;

revoke all on function public.delete_screenshot(uuid) from public;
grant execute on function public.delete_screenshot(uuid) to authenticated;

-- ── Private screenshot storage ───────────────────────────────────────────
-- `public = false`: Storage rejects any unauthenticated/anon read of the
-- bucket outright, regardless of RLS. Deliberately no storage.objects RLS
-- policies are added for `authenticated` either — every access this
-- backend performs (upload, signed URL generation, delete) goes through
-- the service-role client from within an already-authorization-checked
-- Route Handler (see apps/web/src/app/api/time/*), which bypasses Storage
-- RLS entirely. A policy-free private bucket means there is no path for
-- any client to reach a screenshot file directly, signed URL or not,
-- except through code that already ran its own auth check first.
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;
