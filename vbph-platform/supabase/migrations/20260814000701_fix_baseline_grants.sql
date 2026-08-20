-- Baseline table-level grants for `authenticated`.
--
-- Discovered missing via live end-to-end auth testing against real local
-- Supabase (not the plain-Postgres harness used earlier — that harness's
-- manually-configured default privileges turned out not to match how this
-- project's actual Supabase instance provisions new tables). Querying
-- `profiles` as a freshly-authenticated user failed with "permission
-- denied for table profiles" even though the matching RLS policy correctly
-- allows it: Postgres checks table-level GRANTs BEFORE it ever evaluates
-- RLS policies. RLS can only narrow what a grant already allows — it is
-- not a substitute for the grant. Every earlier migration wrote correct
-- RLS policies but never granted the underlying table access those
-- policies depend on.
--
-- All three app roles (CLIENT/VA/ADMIN) are the same Postgres `authenticated`
-- role — differentiated only by profiles.role, checked inside RLS policies
-- — so this grants broadly and trusts RLS (already written, already tested
-- per-policy) to do all the actual row/operation filtering. jobs/placements
-- are the deliberate exception: SELECT stays revoked there (see the
-- rate_privacy_views migration) as a defense-in-depth layer independent of
-- RLS — don't undo that by lumping them into the broad grant below.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.va_profiles,
  public.clients,
  public.client_members,
  public.projects,
  public.job_applications,
  public.time_entries,
  public.time_segments,
  public.screenshots,
  public.invoices,
  public.invoice_items,
  public.payments,
  public.audit_logs
to authenticated;

-- jobs/placements: INSERT/UPDATE/DELETE yes (RLS already scopes these to
-- the owning client or admin), SELECT deliberately withheld — those two
-- tables are readable only through client_jobs_view / va_jobs_view /
-- client_placements_view / va_placements_view.
grant insert, update, delete on public.jobs, public.placements to authenticated;

-- Re-state this explicitly rather than trusting it survived untouched —
-- it's the whole rate-privacy mechanism, worth being paranoid about here.
revoke select on public.jobs from authenticated;
revoke select on public.placements from authenticated;
