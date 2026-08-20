# Application security review

Full security review performed before adding further functionality, per an explicit request to act as a senior application security engineer and test the API, database policies, and server authorization directly — not the UI. Every finding below was reproduced against the real running stack (local Supabase + the Next.js dev server), not inferred from reading code alone; every fix was re-verified the same way afterward, plus a full regression pass (`pnpm -r typecheck`/`lint`, a production build, and re-running every previously-passing exploit/access test) to confirm nothing legitimate broke.

**Methodology**: role-switched `psql` (`SET ROLE authenticated; SET request.jwt.claims = '...'`) to test RLS policies, grants, and RPCs directly as each role; real HTTP requests with real Supabase-issued access tokens (via `POST /auth/v1/token?grant_type=password` for VA/client/admin/second-VA/second-client seed accounts) against the actual `/api/time/*` routes and PostgREST `/rest/v1/rpc/*` endpoints; direct reads of `pg_policies`, `information_schema.column_privileges`, `information_schema.triggers`, and every migration's source to establish ground truth rather than relying on memory of what was intended.

**Result**: 7 confirmed vulnerabilities, all fixed in `supabase/migrations/20260824010000_security_review_fixes.sql` and one application-layer change (`apps/web/src/app/api/time/segments/[segmentId]/screenshot/route.ts`). One of them (database-level suspension enforcement) was systemic, touching the majority of RLS policies in the schema. Everything else reviewed — see [What was reviewed and found clean](#what-was-reviewed-and-found-clean) — held up under active testing.

## Findings

### 1. CRITICAL — Account suspension was not enforced at the database layer

**The gap.** `requireRole()`/`authenticateApiRequest()` both check `profiles.status <> 'suspended'` and correctly block a suspended user from the Next.js app and the `/api/time/*` API. But no RLS policy anywhere in the schema checked `profiles.status` at all — every ownership/role check (`current_user_role()`, `is_client_member()`, `va_owns_placement()`, the dozen-plus inline `id = auth.uid()` policies) treated a suspended user identically to an active one. A still-valid JWT (issued before suspension, or simply not yet expired) was sufficient to bypass the application layer entirely via a direct request to the Supabase REST/RPC endpoints — endpoints whose URL and anon key are, by this project's own design, public (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`), since RLS is supposed to be the actual enforcement boundary.

**Reproduced.** Suspended a VA (`update profiles set status='suspended'`), then, using that VA's still-valid access token:
- App layer: `GET /api/time/me` → `403 "This account is suspended."` (correctly blocked).
- Direct REST: `POST /rest/v1/time_entries` with that same token → `201 Created`, a brand new time entry, as if nothing had happened.

**Fix.** `active_uid()` — a new function that returns `auth.uid()` unless that profile's `status = 'suspended'`, in which case it returns `NULL`. Every RLS policy and ownership-helper function that used `auth.uid()` to establish "this is the caller's own row" (`current_user_role()`, `is_client_member`, `is_client_owner`, `va_is_approved`, `va_owns_placement`, `va_has_placement_on_project`, `va_has_placement_with_client`, the `va_jobs_view`/`va_placements_view`/`va_compensation_view` view definitions, and nine inline "select/update own row" policies across `profiles`, `va_profiles`, `client_members`, `job_applications`, `audit_logs`) now routes through `active_uid()` instead. Because `current_user_role()` alone feeds every `"<table>_admin_all"` policy in the schema, redefining that one function fixed the majority of the surface in a single change; the rest were fixed individually to match.

**Verified.** Post-fix, the same suspended VA gets `0` rows from `time_entries`, `profiles`, and `va_placements_view`, and a `new row violates row-level security policy` error on the same direct INSERT that previously succeeded. Re-activating the account restores full access immediately with no other change. A parallel check confirmed admin access (`current_user_role() = 'ADMIN'`-based policies) is completely unaffected for a non-suspended admin.

### 2. HIGH — A VA could fabricate pre-approved billable time

**The gap.** `time_entries_insert_va`'s `WITH CHECK` only verified `va_owns_placement(placement_id)` — it never constrained `status`. Combined with a table-level INSERT grant that included `status`/`approved_by`/`approved_at`, a VA could `INSERT` a `time_entries` row with `status: 'approved'` directly, skipping the entire admin-review step the column exists to gate. Since a timesheet's `approved_hours` (frozen at lock time, feeding directly into invoicing and VA compensation) is computed by summing segments whose parent entry has `status = 'approved'`, this was a direct path to self-approved, fabricated pay with zero admin involvement.

**Reproduced.** `INSERT INTO time_entries (placement_id, started_at, ended_at, status, approved_by, approved_at) VALUES (<own placement>, ..., 'approved', <own id>, now())` as the VA — succeeded, returned the row with `status: 'approved'`.

Separately, `time_entries_update_va_pending`'s `WITH CHECK` *did* correctly block flipping `status` on an existing row (the check requires the row to remain `'pending'` post-update) — but the same broad grant let a VA write `approved_by`/`approved_at` onto their own still-pending entry, tampering with review-audit metadata without changing status.

**Fix.** Narrowed the INSERT grant to `(placement_id, started_at, ended_at)` and the UPDATE grant to `(ended_at)` only — the exact columns the legitimate flows (`startTimer()`, `stopTimer()`) ever need to write. `status`/`approved_by`/`approved_at` can now only ever be set by `admin_set_time_entry_status()`, which is `SECURITY DEFINER` and bypasses grants entirely. Any VA-originated INSERT now lands at the table's own default (`'pending'`) regardless of what the request body contains.

**Verified.** The same INSERT now fails (`permission denied for table time_entries`); a plain `INSERT (placement_id) VALUES (...)` still succeeds and correctly defaults to `pending`. The `approved_by` tampering UPDATE now also fails; `UPDATE ... SET ended_at = now()` (the real `stopTimer()` path) still succeeds. Full start→stop cycle re-tested end-to-end through the real API after the fix.

### 3. MEDIUM — A VA could fabricate a pre-"HIRED" job application

Same root cause and shape as #2: `job_applications_insert_approved_va`'s `WITH CHECK` didn't constrain `status`, and the INSERT grant included it. A VA could `INSERT ... status: 'HIRED'` directly. Lower severity than #2 — actual placement creation (and rate-setting) is separately admin-gated and unaffected — but still a deceptive bypass of the intended hiring workflow that could mislead an admin reviewing applications. Fixed the same way: INSERT grant narrowed to `(job_id, va_id, cover_note, relevant_experience, notes, expected_availability)`, `status` excluded, defaults to `'SUBMITTED'`. Verified: the direct `status: 'HIRED'` insert now fails; a normal application insert still succeeds and correctly defaults.

### 4. HIGH — A timesheet could be inserted already `LOCKED` with fabricated hours

**The gap.** `timesheets_insert_admin`'s `WITH CHECK` only verified `is_admin()`. The `timesheets_locked_has_snapshot` CHECK constraint only requires that a `LOCKED` row have *non-null* hour columns — it says nothing about whether those numbers came from `admin_set_timesheet_status()`'s atomic, segment-derived computation. A plain `INSERT INTO timesheets (..., status, approved_hours, ...) VALUES (..., 'LOCKED', 999, ...)` bypassed that computation entirely, undermining the core guarantee the two prior phases (weekly timesheets, weekly invoices) were built around: that a locked timesheet's numbers are always exactly what was computed from real segment data at the moment of locking.

**Fix.** INSERT grant narrowed to `(placement_id, week_start)` only — a fresh row can now only ever land as `OPEN` with `NULL` hours (the table's own defaults); reaching `LOCKED` is only possible through the RPC. **Verified**: the fabricated-`LOCKED` insert now fails; the real generation path (`INSERT (placement_id, week_start)`) still succeeds.

### 5. HIGH — A client company owner could reverse their own suspension

**The gap.** `clients_update_owner`'s `WITH CHECK` (`is_client_owner(id)`) placed no restriction on which columns an owner could change, and the UPDATE grant included `status`. A client whose company an admin suspended could simply `UPDATE clients SET status = 'active' WHERE id = <own client>` and undo it — the exact same self-escalation bug class already fixed for `profiles.role` and `va_profiles.approval_status` in the `admin_portal` migration, but never applied to `clients`.

**Reproduced**: forced a client to `suspended` (simulating an admin action), then as that client's owner, ran the UPDATE — succeeded, `status` back to `active`.

**Fix.** A `BEFORE UPDATE` trigger, `prevent_client_self_status_change`, identical in shape to the existing `prevent_self_privilege_escalation`/`prevent_self_approval` triggers: rejects any change to `status` from a real end-user session unless `is_admin()`. **Verified**: the same UPDATE now raises `Only an admin can change a client's status.`; the client can still update unrelated columns (`company_name`, etc.) on the same row; admin can still change status freely.

### 6. LOW — Screenshot upload trusted the client-claimed MIME type

**The gap.** `POST /api/time/segments/:id/screenshot` validated the uploaded file's `Content-Type` against an allowlist (`image/png`/`image/jpeg`/`image/webp`) and enforced a size limit, but never inspected the actual bytes — a `Blob`'s `.type` is caller-supplied and trivially spoofable (`new Blob([htmlBytes], {type: "image/jpeg"})`). Practical impact was already low (the `screenshots` bucket is private, reachable only via short-lived signed URLs on Supabase Storage's own origin, and the app only ever renders them via `<img>`, never `<iframe>`/direct navigation), but it's a real gap under "insecure file uploads."

**Fix.** Added a magic-byte check (`matchesMagicBytes()`) for all three allowed formats (PNG's 8-byte signature, JPEG's `FF D8 FF` marker, WebP's `RIFF....WEBP` structure) before the file ever reaches Storage. **Verified**: a plain-text file relabeled `image/jpeg` is now rejected (`415 File content doesn't match its declared type.`); a real JPEG still uploads and produces a working signed URL.

### 7. Informational — `clients`/`placements` rely on RLS alone, not column grants, for row-scoping (intentional, re-confirmed, not a new issue)

`placements` and `clients` both grant broad column-level SELECT/UPDATE to `authenticated` (documented, deliberate decisions from the `hiring_workflow` and original migrations respectively — RLS's `placements_admin_all`/`clients_admin_all` are each table's *only* relevant policy for non-owner-scoped access, so a broad grant is safe as long as RLS genuinely returns zero rows for everyone else). Re-verified directly: a VA or client session querying `placements` or the rate-sensitive columns of `clients` gets zero rows / `permission denied`, confirming this existing design is sound. Not a finding, listed for completeness since it was directly examined.

## What was reviewed and found clean

Each of these was actively tested, not just read — see the specific reproduction for each in the sections below where one is relevant.

- **Client rate leakage to VAs**: direct `placements`/`jobs` queries (0 rows / `permission denied for table jobs`), `va_placements_view`/`va_jobs_view` (no `client_hourly_rate`/`agency_margin` column — `column does not exist`, not filtered), `admin_placements_view`/`admin_compensation_view`/`admin_invoice_items_view` (0 rows, `is_admin()` gate). All confirmed for both the placement's own VA and an unrelated VA.
- **VA compensation leakage to clients**: `va_compensation_view` and `admin_compensation_view` both return 0 rows for a client session; `invoice_items.va_payout_amount`/`margin_amount` are unreachable via the base table (`permission denied for table invoice_items`, a column-GRANT boundary, not a view filter).
- **IDOR / ID substitution**: a VA substituting another VA's `timeEntryId`/`segmentId`/`screenshotId` into `POST /api/time/segments`, `PATCH .../stop`, `PATCH .../activity`, `POST .../screenshot`, and `DELETE /api/time/screenshots/:id` — every one correctly returned `404`/`403` (RLS makes the row invisible or the explicit ownership check in `delete_screenshot()` rejects it). Starting a timer against an unowned placement → `403`.
- **Cross-client data isolation**: a second client (Globex) querying `/api/time/diary` across a wide date range saw only their own VA's session, never the first client's (Acme's).
- **Logged-out / unauthenticated access**: every `/api/time/*` endpoint (including screenshot delete) returns `401` with no `Authorization` header or a garbage bearer token; direct requests to the Storage object path (public or private, with or without a valid-but-unrelated JWT) all fail (`400`/`404`) — there are no `storage.objects` policies for `authenticated` at all, so even the legitimate owner cannot bypass the signed-URL flow.
- **VA calling admin endpoints directly**: all five admin RPCs (`admin_generate_weekly_invoice`, `admin_set_timesheet_status`, `admin_update_placement_rates`, `admin_set_time_entry_status`, `admin_correct_locked_timesheet`) rejected a VA's real bearer token with `Not authorized` via raw `POST /rest/v1/rpc/*` calls — not just via the UI. Every exported function across all 10 `admin-*.ts` Server Action files was confirmed to call `requireRole("ADMIN")` (grepped, not sampled).
- **Role escalation**: `profiles.role`/`va_profiles.approval_status` self-escalation (the two already-known-fixed bugs) re-confirmed still blocked; `time_entries.status` UPDATE-based escalation confirmed blocked by its `WITH CHECK` (distinct from the INSERT-based bypass in Finding 2, which *was* real).
- **SQL injection**: no raw SQL string concatenation anywhere in the app (`supabase-js`'s query builder is parameterized throughout); the only `.or()` PostgREST-filter-string usage interpolates a JS `Date.toISOString()` output, never raw user input.
- **XSS**: zero uses of `dangerouslySetInnerHTML` anywhere in `apps/web`/`apps/desktop`; React's default JSX escaping is never bypassed.
- **CSRF**: `/api/time/*` requires an explicit `Authorization: Bearer` header (no ambient browser credential to ride on — bearer-token APIs are inherently CSRF-immune); Next.js Server Actions' built-in Origin-header verification is on by default and not weakened anywhere in `next.config.ts`.
- **Service-role key / env exposure**: `SUPABASE_SERVICE_ROLE_KEY` is never `NEXT_PUBLIC_`-prefixed, is read in exactly one place (`lib/supabase/admin.ts`, guarded by `import "server-only"` — a build-time error if ever imported into a Client Component), and every one of its import sites is a route handler, Server Action, or server-only query file. `.env.local` is gitignored and not tracked. The desktop app's `.env.local` contains only the anon key, never a service-role key.
- **Sensitive-value logging**: no `console.log` of tokens/passwords/secrets anywhere in either app.

## Fixed but worth calling out: legitimate flows re-verified after every fix

Every fix in this document was re-verified twice: once to confirm the exploit is closed, and once to confirm the corresponding *legitimate* flow still works unmodified — narrow column grants are easy to get subtly wrong in a way that breaks real functionality instead of just closing a gap. Specifically re-tested post-fix: a full VA start→stop timer cycle through the real `/api/time/*` API; a normal job application submission; timesheet generation-style inserts; a client updating their own non-status fields while suspended; admin's own unrestricted access to every table and RPC; and the complete `pnpm -r typecheck`/`lint` + `next build` pipeline (all four portals' route trees, including every route added in the last three phases, still present and compiling).

## What's deliberately not covered by this review

- **Rate limiting / brute-force protection** on login or any endpoint — not evaluated; this app currently has none beyond whatever Supabase Auth provides by default.
- **Dependency/supply-chain vulnerabilities** (`npm audit`-class findings) — out of scope; this review focused on this application's own authorization logic, not third-party package CVEs.
- **Infrastructure-level concerns** (TLS configuration, database network exposure, Docker/Colima hardening) — this environment is local-only development infrastructure; a real deployment's infra posture is a separate review.
- **The client-supplied clock/segment-timing trust boundary**: a sufficiently technical VA can already submit fabricated `time_segments` (backdated, self-reported durations) through the legitimate, correctly-authorized API — this is an inherent property of a self-reported time-tracking system, mitigated by screenshots and activity monitoring for human review, not by this review's scope of "is the request authorized," which it is.
