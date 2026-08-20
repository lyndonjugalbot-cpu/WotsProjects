-- Job Applications: full application content (relevant experience, notes,
-- expected availability), a real hiring-pipeline status set, and a
-- structurally separate admin-notes mechanism clients/VAs can never read.

-- ── New application fields ──────────────────────────────────────────────

alter table public.job_applications
  add column relevant_experience text,
  add column notes text,
  add column expected_availability text;

comment on column public.job_applications.cover_note is 'Short cover message from the VA.';
comment on column public.job_applications.relevant_experience is 'VA-described relevant experience for this role.';
comment on column public.job_applications.notes is 'Optional additional notes from the VA.';
comment on column public.job_applications.expected_availability is 'VA-described availability, e.g. "Immediately" or "2 weeks notice".';

-- ── Status: real hiring-pipeline states, uppercase ──────────────────────
-- 'accepted' (the only prior terminal-positive value) maps to HIRED — the
-- one seeded 'accepted' row already has a real placement against it.

alter table public.job_applications alter column status drop default;

update public.job_applications set status = upper(status);
update public.job_applications set status = 'HIRED' where status = 'ACCEPTED';

alter table public.job_applications drop constraint job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check
  check (status in (
    'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW',
    'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'
  ));

alter table public.job_applications alter column status set default 'SUBMITTED';

-- withdraw_own's WITH CHECK pins the post-update status value — update it
-- to match the new uppercase vocabulary. (This policy already had an
-- explicit WITH CHECK from the original schema pass, unlike the
-- jobs_update_owner gap documented in docs/database.md — just a casing
-- fix here, not a missing-clause fix.)
alter policy job_applications_withdraw_own on public.job_applications
  with check (va_id = auth.uid() and status = 'WITHDRAWN');

-- ── Let a client view the profile of anyone who applied to their job ───
-- client_can_view_va() previously only covered VAs with an actual
-- placement. A client reviewing applicants needs to see the applicant's
-- profile (name, headline, skills, experience) before any placement
-- exists — broadening this one helper (rather than adding a parallel
-- "client_can_view_applicant" + duplicating the two policies that already
-- reference it) keeps "can this client see this VA's profile" as a
-- single source of truth with two legitimate reasons.
create or replace function public.client_can_view_va(target_va_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.placements
    where va_id = target_va_id and public.is_client_member(client_id)
  ) or exists (
    select 1 from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    where ja.va_id = target_va_id and public.is_client_member(j.client_id)
  );
$$;

-- ── Admin notes: a structurally separate table, not a column ───────────
-- A column on job_applications would need to be remembered and excluded
-- from every client/VA-facing select forever. A separate table with its
-- own RLS (admin-only, full stop) means there is no query path for a
-- client or VA to ever reach this data, by construction — the same
-- "structurally absent" principle as the rate-privacy views in
-- docs/database.md, applied to a table instead of a column.

create table public.application_admin_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.application_admin_notes enable row level security;

create policy application_admin_notes_admin_all on public.application_admin_notes
  for all
  using (is_admin())
  with check (is_admin());

-- Same pattern as audit_logs: grant broadly to `authenticated` and let
-- RLS (admin-only, above) do the actual restricting — a client or VA
-- session has no policy that ever matches a row here, so a blanket grant
-- doesn't expose anything.
grant insert, select, update, delete on public.application_admin_notes to authenticated;
