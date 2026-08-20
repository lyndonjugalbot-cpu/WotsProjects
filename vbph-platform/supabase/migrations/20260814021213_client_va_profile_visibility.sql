-- Gap found while building the client dashboard: a client legitimately
-- needs a placed VA's name/photo (profiles) and headline (va_profiles) for
-- "My Team" cards, but the only existing SELECT policies on those two
-- tables are "own row" and "admin" — there was no path for a client to
-- read ANY column of a VA's profile, even one they're actually paying for.
--
-- Scoped narrowly: a client can see a VA's profiles/va_profiles row only
-- if a placements row actually links that VA to a client company they
-- belong to. No rate data lives on either table, so a plain row-level
-- policy (not a view) is sufficient here — unlike jobs/placements.

create or replace function public.client_can_view_va(target_va_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where va_id = target_va_id and public.is_client_member(client_id)
  );
$$;

create policy "profiles_select_placed_va_by_client" on public.profiles
  for select using (public.client_can_view_va(id));

create policy "va_profiles_select_by_client" on public.va_profiles
  for select using (public.client_can_view_va(id));
