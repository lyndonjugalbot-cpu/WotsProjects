-- Missing FK indexes, found during the production-readiness performance
-- review. Postgres never auto-indexes a foreign key column — only what's
-- listed here (plus whatever a UNIQUE constraint already covers as its
-- leading column) has one. Every index below backs either a query filter
-- used in apps/web/src/server/queries/**, or an RLS helper function
-- (docs/database.md) that runs per-row on every RLS-checked read.
--
-- Safe to run against a live database: CREATE INDEX (non-CONCURRENTLY)
-- takes a lock, but these tables are empty/near-empty at the time this
-- runs (fresh production launch) so the lock is instantaneous. If this
-- ever needs to run again against a table with real production volume,
-- switch to CREATE INDEX CONCURRENTLY (which can't run inside an implicit
-- migration transaction — split it into its own migration file first).

-- Hottest tables in the product — every Work Diary / timesheet read
-- filters on these. Highest priority of everything in this file.
create index if not exists time_segments_time_entry_id_idx on public.time_segments (time_entry_id);
create index if not exists time_entries_placement_id_idx on public.time_entries (placement_id);

-- Invoice detail page.
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists invoice_items_placement_id_idx on public.invoice_items (placement_id);
create index if not exists invoice_items_time_entry_id_idx on public.invoice_items (time_entry_id);

-- placements.client_id/va_id/project_id: dashboards, admin views, and the
-- va_has_placement_on_project()/va_has_placement_with_client() RLS helper
-- functions all filter here — an RLS helper runs per row, so an unindexed
-- filter inside one multiplies cost with table size.
create index if not exists placements_client_id_idx on public.placements (client_id);
create index if not exists placements_va_id_idx on public.placements (va_id);
create index if not exists placements_project_id_idx on public.placements (project_id);
create index if not exists placements_job_id_idx on public.placements (job_id);

-- Client invoice list (RLS + query both filter client_id).
create index if not exists invoices_client_id_idx on public.invoices (client_id);

-- job_applications has a unique(job_id, va_id) constraint, which only
-- indexes job_id as its leading column — "my applications" (VA-side)
-- lookups filter va_id alone and got no benefit from it.
create index if not exists job_applications_va_id_idx on public.job_applications (va_id);

-- Same shape of problem: client_members has unique(client_id, profile_id),
-- but "which client does this signed-in user belong to" (resolved on
-- essentially every client-portal request) filters profile_id alone.
create index if not exists client_members_profile_id_idx on public.client_members (profile_id);

-- Lower-traffic, still real.
create index if not exists jobs_client_id_idx on public.jobs (client_id);
create index if not exists jobs_created_by_idx on public.jobs (created_by);
create index if not exists time_entries_approved_by_idx on public.time_entries (approved_by);
create index if not exists timesheets_submitted_by_idx on public.timesheets (submitted_by);
create index if not exists timesheets_approved_by_idx on public.timesheets (approved_by);
create index if not exists timesheets_locked_by_idx on public.timesheets (locked_by);
