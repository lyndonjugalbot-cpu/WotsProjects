-- VA Job Marketplace: closes a gap the job_applications RLS never checked
-- — the INSERT policy only verified the VA was approved, not that the job
-- being applied to was actually OPEN. Nothing in the schema stopped an
-- approved VA from applying to a DRAFT, PAUSED, FILLED, or CLOSED job via
-- a hand-crafted request bypassing the UI (the UI would only ever offer
-- "Apply" on an OPEN job, but that's not a security boundary).

-- SECURITY DEFINER, same pattern as client_owns_job/is_client_owner — the
-- caller (a VA) has no SELECT grant on `jobs` at all, so a plain subquery
-- in the policy expression would fail on a permission check, not just
-- return false. exists(...) is inherently NULL-safe (always true/false),
-- unlike the scalar-subquery helpers documented in docs/database.md, so
-- no coalesce() is needed here.
create or replace function public.job_is_open(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs where id = target_job_id and status = 'OPEN'
  );
$$;

alter policy job_applications_insert_approved_va on public.job_applications
  with check (va_id = auth.uid() and va_is_approved() and job_is_open(job_id));
