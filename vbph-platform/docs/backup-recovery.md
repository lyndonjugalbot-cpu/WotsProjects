# Backup & recovery — Supabase

Recommendation for the production Supabase project backing `apps/web`/`apps/desktop`. Nothing here is provisioned yet — this is what to configure before launch.

## What's at risk

Two categories, different recovery needs:

- **Database (Postgres)** — every table in `supabase/migrations/*.sql`: accounts, rate-sensitive `jobs`/`placements`/`invoices`, time-tracking data, `audit_logs`. Losing this is losing the business record.
- **Storage** — the screenshots bucket. Losing this loses evidentiary work-diary data (still-open time entries/disputes reference it) but not the financial record, which lives in Postgres (`time_segments`, `timesheets`) independent of whether the screenshot itself survives.

## Database backups

Supabase's built-in backup tier depends on the project's plan:

| Plan | What you get | Gap |
|---|---|---|
| Free/Pro (no add-on) | Daily backups, 7-day retention, restored by Supabase support on request | No point-in-time recovery (PITR) — a mistake made 2 hours ago costs you up to a day of data on restore; restore isn't self-service |
| Pro + PITR add-on | Continuous WAL archiving, restore to any point within the retention window (min. 7 days, configurable) | Cost scales with retention window and database size |

**Recommendation for launch:** enable the **PITR add-on** before going live, not after the first incident. This is a financial/HR-adjacent product (invoices, payroll-adjacent VA compensation, audit logs) — daily-granularity recovery is not adequate once real client money and VA hours are involved. Set retention to at least 14 days; align with however long a disputed invoice/timesheet can realistically stay open.

**Independent of the Supabase tier**, add a second, self-owned backup path — never rely solely on your infrastructure provider's own backup of itself:
- A scheduled `pg_dump` (nightly, via `supabase db dump` or direct `pg_dump` against the connection string) pushed to a separate storage provider (S3/GCS/Backblaze) in a different account than Supabase. This is what protects against a Supabase-account-level incident (billing lockout, accidental project deletion, provider-side outage) that PITR alone doesn't cover, since PITR lives inside the same Supabase project you're trying to protect against losing.
- Verify restores periodically (quarterly at minimum) — an untested backup is a hypothesis, not a backup. Restore the dump into a scratch project and spot-check row counts against a few key tables (`profiles`, `placements`, `invoices`).

## Storage (screenshots) backups

Supabase Storage is not covered by Postgres PITR — it's a separate concern.

- Enable **Storage bucket replication/backup** if available on your plan, or run a scheduled sync (e.g. `rclone`/`aws s3 sync` equivalent against Supabase's S3-compatible endpoint — `[storage.s3_protocol]` is already enabled in `supabase/config.toml`) to a separate bucket in a separate account.
- Decide and document a **retention policy** before launch, not after storage costs surprise you: screenshots are the highest-volume, fastest-growing data in this system (one per ~10-minute segment, potentially thousands per VA per month). A reasonable default: keep screenshots for the current + prior billing cycle at full resolution, then either delete or move to cold/archive storage past that — driven by how long a timesheet/invoice dispute window realistically stays open, matching the PITR retention decision above.

## Recovery playbook (write this down before you need it, not during an incident)

1. **Define RPO/RTO explicitly.** Recommendation to start from: RPO (max acceptable data loss) = 1 hour via PITR; RTO (max acceptable downtime) = a few hours for a full project restore. Adjust once you know real usage patterns, but write a number down — "as fast as possible" is not a plan.
2. **Document the actual restore procedure** (Supabase dashboard steps for PITR restore, or CLI steps for a `pg_dump` restore) somewhere the on-call person can find it without needing to research Supabase's docs live during an incident.
3. **Know who can authorize a restore.** A PITR restore is destructive to data written after the restore point — decide in advance who has authority to pull that trigger, so it isn't a during-incident debate.
4. **Practice it once** before launch. A dry-run restore into a scratch project, timed, so the RTO estimate above is based on something real.

## What this repo does NOT yet have (flagged in the readiness report)

No backup automation, no documented RPO/RTO, and no verified restore have been set up as part of this review — this document is the recommendation, not a confirmation that it's done. Provisioning the Supabase-side settings (PITR add-on, retention window) and the independent `pg_dump`/Storage-sync job are both manual setup steps in the Supabase dashboard / your CI-scheduler of choice, outside what this codebase can configure on its own.
