# Monitoring & logging — recommendation

Current state, confirmed during the production-readiness review: no structured logging library (`pino`/`winston`/etc.), no error-tracking SaaS (Sentry or similar), and no uptime/APM monitoring are wired into `apps/web`, `apps/desktop`, or the Supabase project. All server-side signal today is `console.error` (a handful of call sites) landing wherever the host's raw stdout goes. This document is what to add before launch, in priority order.

## 1. Error tracking (highest priority — currently zero coverage)

Add an error-tracking SDK to `apps/web` (server + client) and `apps/desktop`. Sentry is the pragmatic default — first-class Next.js App Router support (server actions, route handlers, RSC), a Tauri/Rust SDK for the desktop side, and a generous free tier adequate for launch-scale traffic.

- **`apps/web`**: wrap the existing `console.error` call sites (`server/time-tracking/service.ts:407`, `lib/api/auth.ts:122`, and any Server Action catch blocks) to also report to the tracker, not just stdout. Add root-level `error.tsx`/`global-error.tsx` (currently only `client/dashboard/error.tsx` exists — every other route falls through to the framework default on an uncaught render error) and report from there too.
- **`apps/desktop`**: the offline queue's sync-failure logging (`lib/offlineQueue.ts`) is exactly the kind of signal that's currently invisible once the app is out on VAs' machines — you cannot `tail` a distributed desktop app's console. This is the highest-value place to add tracking, since it's your only visibility into whether tracked time is actually reaching the server for VAs you aren't watching directly.
- **Scrub before shipping**: confirm the tracker's request-body capture doesn't collect the `Authorization` header or screenshot binary content — configure scrubbing rules explicitly rather than trusting SDK defaults.

## 2. Structured server logging

Replace ad hoc `console.error` with a structured logger (`pino` is a reasonable default for a Next.js server — fast, low overhead, JSON output that any log aggregator can ingest) so logs are:
- Machine-parseable (JSON, not string interpolation) — required for any downstream log search/alerting to work well.
- Leveled (`debug`/`info`/`warn`/`error`) so production can run at `info`+ without losing the ability to turn on `debug` temporarily.
- Consistently shaped — a `requestId`/`userId` (never PII beyond that) on every log line makes "show me everything that happened for this one failed request" possible; today's `console.error("[stopTimer] update failed:", ...)` string-prefix convention doesn't support that.

**Do not log full Supabase/Postgres error objects as-is** (current pattern in `service.ts:407` logs the raw error object) — extract the fields you actually need (code, message) rather than passing the whole object through, since Postgres errors can include table/column/constraint names that are useful for debugging but shouldn't be indiscriminately warehoused in a third-party log platform without thinking about it first.

## 3. Uptime / synthetic monitoring

Independent of error tracking (which only fires when something inside the app throws) — an external check that the app is reachable at all:
- A simple uptime monitor (e.g. Better Uptime, UptimeRobot, or your host's built-in health check) hitting a lightweight endpoint on an interval, alerting on downtime.
- If deploying to Vercel: their own platform status/analytics cover some of this, but a third-party external check is still worth having — it's the only thing that tells you your DNS/CDN edge is actually serving traffic, independent of the platform reporting itself healthy.

## 4. Database & Storage observability (Supabase dashboard)

Already available without adding anything to the codebase — turn these on / check them regularly starting at launch, not after a slowdown is reported by a user:
- **Supabase → Reports**: CPU/memory/disk/connection-count trends. Set an alert threshold on connection count specifically — a connection-pool exhaustion (a real risk once traffic grows past what `[db.pooler]` in `supabase/config.toml` is tuned for locally) shows up here first.
- **Supabase → Logs → Postgres logs**: slow-query and error logs live here already; worth a weekly skim pre-launch, and an alert on error-rate spikes post-launch.
- **Storage usage trend**: screenshots are the fastest-growing data in this system (see `docs/backup-recovery.md`'s retention discussion) — track bucket size growth so it doesn't surprise you on the bill.

## 5. Business-metric visibility (lower priority, but cheap once the above exists)

Once structured logging + an error tracker exist, a small amount of additional instrumentation goes a long way for a staffing marketplace specifically: track application → hire conversion, time-entry → approval latency, and invoice → payment latency as simple counters/timers. Not blocking for launch, but worth planning for since `audit_logs` (already populated — see the error-handling review) is a natural source for some of this without any new instrumentation.

## What to actually do before launch (minimum bar)

At minimum before going live: (1) an error tracker wired into `apps/web` server + client, (2) root `error.tsx` added, (3) an external uptime check, (4) Supabase dashboard alerts on connection count and error rate turned on. Structured logging and business metrics are valuable but can follow shortly after launch rather than blocking it.
