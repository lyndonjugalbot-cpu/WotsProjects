# Production deployment checklist

Use this before the first production launch, and re-run the relevant sections before any subsequent deploy that touches auth, RLS, storage, or migrations. Paired with `docs/backup-recovery.md` and `docs/monitoring-logging.md` — do those two first, since several items below assume they're in place.

## 0. Version control (do this first — nothing else here matters if this isn't true)

- [ ] `vbph-platform/` is committed to a real git repository with full history. As of this review it is **not** — confirm with `git status` before proceeding with anything else.
- [ ] Root-level `.gitignore` exists and covers env files repo-wide (added during this review — verify it's actually committed, not just present on disk).
- [ ] `git log` / `git diff` reviewed once more immediately before the initial commit to confirm no `.env*` (other than `*.example` files), no `supabase/.temp/`, no real credentials anywhere in what's about to be committed. Run `git status --ignored` and eyeball every ignored-vs-tracked file once.
- [ ] A remote (GitHub/GitLab/etc.) is set up, and — separately — a deploy pipeline is connected to it (Vercel git integration or equivalent) so "push to main" has a defined, repeatable outcome instead of manual deploys.

## 1. Supabase — production project

- [ ] A **separate Supabase project** exists for production (never share a project between dev and prod — this review found nothing suggesting they're currently shared, but confirm explicitly before go-live).
- [ ] All 22+ migrations in `supabase/migrations/` applied cleanly to the production project via `supabase db push` (or CLI-linked deploy), **in order, against a genuinely empty database** — several migrations (see readiness report) update rows before dropping the CHECK constraint that would otherwise block those values, which only works safely against an empty table. If migrations are ever applied to a production project that already has data (e.g., a re-platform, not a fresh launch), those specific migrations need manual review first.
- [ ] `supabase/seed.sql` is **never** run against the production project. It now refuses to run against a non-empty `auth.users` table as a safety net, but the actual rule is: don't run it, ever, against anything but a local `supabase db reset`.
- [ ] The first ADMIN account is provisioned manually — there is no self-service path to create one (by design: the only in-app user-creation route is itself admin-gated). After the first real signup, promote that one row: `update public.profiles set role = 'ADMIN' where id = '<their auth.users id>';` via the Supabase SQL editor, then immediately verify they can sign in and see the admin portal, then never do this for any other account.
- [ ] Auth → URL Configuration: Site URL and every Redirect URL point at the real production domain, not `localhost`/`127.0.0.1`.
- [ ] Auth → Email templates: sender domain has SPF/DKIM configured, not the default shared Supabase sender (production deliverability + shows a trustworthy sender to VAs/clients).
- [ ] PITR (point-in-time recovery) add-on enabled — see `docs/backup-recovery.md`.
- [ ] Storage bucket(s) confirmed `public = false` (already true in migrations — re-verify in the dashboard after the project is provisioned, since bucket settings aren't purely migration-driven on every Supabase setup).

## 2. Environment variables

- [ ] `apps/web/.env.production.example` and `apps/desktop/.env.production.example` (added during this review) used as the checklist for what to set in the host's environment-variable UI — not as files copied into the repo with real values.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real production domain. This was previously undocumented and defaults to `http://localhost:3000` if unset — a real risk of production password-reset emails linking to localhost if this step is skipped.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set **only** in the host's server-side environment store, never in a `NEXT_PUBLIC_*`-prefixed variable, never in anything that reaches `apps/desktop`.
- [ ] `apps/desktop`'s `VITE_API_BASE_URL` and Tauri's CSP `connect-src` (see readiness report — currently hardcodes dev-only hosts) both updated to the real production API origin before cutting a production desktop build.

## 3. Application-level gaps to close before launch

(See the full readiness report for severity/detail — this is the checklist form.)

- [ ] Root `error.tsx` / `global-error.tsx` added to `apps/web/src/app` (currently only exists for one nested route).
- [ ] Error tracking wired in for both `apps/web` and `apps/desktop` — see `docs/monitoring-logging.md`.
- [ ] CORS / Tauri CSP reviewed so the desktop app can actually reach the production API (flagged as a likely-breaking gap, not just hardening).
- [ ] Some form of rate limiting added to the time-tracking API routes, at minimum the screenshot-upload endpoint.
- [ ] Sign-up error messages reviewed for email-enumeration consistency (`signUpAction` currently returns a different message shape than the deliberately-generic sign-in/password-reset messages).

## 4. Desktop app distribution

- [ ] Code signing configured (macOS notarization, Windows Authenticode) — an unsigned build triggers OS security warnings that will make VAs distrust or fail to install the tracker.
- [ ] Auto-updater endpoint (if used) points at the production feed, not dev/staging.
- [ ] A production build actually installed and smoke-tested on a clean machine (not a dev machine with the Supabase CLI / local env already configured) before wide distribution to VAs.

## 5. Performance / load

- [ ] Address the indexing/pagination gaps in the readiness report before onboarding real volume — these degrade gradually, not with a hard failure, so they're easy to defer past the point where fixing them is disruptive.
- [ ] A basic load check (even informal — a script hitting the time-entry/segment endpoints at realistic VA-concurrency) before the first real cohort of VAs starts tracking simultaneously.

## 6. Go-live day

- [ ] Backup restore has been practiced once (see `docs/backup-recovery.md`) — not for the first time during an actual incident.
- [ ] Monitoring/alerting (error tracker, uptime check, Supabase connection-count alert) is live and confirmed to actually fire — send yourself a deliberate test error before relying on it.
- [ ] Rollback plan for the web app deploy is known (host's deploy-history revert) and, separately, a plan exists for what "rollback" even means for a migration that's already been applied to production Postgres (usually: forward-fix, not revert — write this down so it isn't decided under pressure).
- [ ] Support/on-call contact known for at least the first 48 hours post-launch.
