-- Adds a client-generated idempotency key to time_segments so a retried
-- "create segment" request (e.g. the desktop app resending a queued
-- segment after losing the response to a dropped connection, without
-- knowing whether the original request actually landed) can be
-- recognized as the SAME request rather than producing a duplicate,
-- billable segment. See docs/database.md ("Offline resilience in the
-- desktop app") for the full reconciliation design this supports.
--
-- Nullable: existing rows (seed data, anything created before this
-- migration) have no client-generated id to backfill honestly. New rows
-- from the desktop app always provide one — enforced at the application
-- layer (createSegmentSchema requires it), not here, since a NOT NULL
-- constraint would also have to reject the (intentionally still valid)
-- historical rows.
alter table public.time_segments
  add column client_segment_id uuid;

-- Partial unique index (only over non-null values) rather than a plain
-- unique constraint: multiple historical NULL rows must remain valid,
-- and a plain UNIQUE constraint treats NULLs as distinct from each other
-- anyway in Postgres — but a partial index says the same thing more
-- explicitly and keeps the index smaller by excluding rows that will
-- never be looked up by this column.
create unique index time_segments_client_segment_id_key
  on public.time_segments (client_segment_id)
  where client_segment_id is not null;
