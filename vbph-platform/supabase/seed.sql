-- Development seed data. Run automatically by `supabase db reset` (local
-- Supabase via the CLI/Docker) — NOT intended to run against a production
-- project.
--
-- All auth.users columns below (confirmation_token, email_change, etc. as
-- empty strings rather than NULL) match Supabase's actual local auth
-- schema requirements, not just the minimal columns — GoTrue expects those
-- as '', not NULL. Passwords are all 'password123' for every seeded user.
--
-- Fixed UUIDs throughout (not gen_random_uuid()) so this script is
-- idempotent-ish to read and so every FK reference below is predictable.
--
-- ── Production safety guard ──────────────────────────────────────────
-- This script creates real-looking accounts with a shared, publicly-known
-- password ('password123'). There is no way for SQL alone to reliably
-- detect "is this production" in general, so this is a speed bump against
-- the most common accident — running this file against a project that
-- already has real users — not a substitute for the actual rule: NEVER
-- run `supabase db reset` (or paste this file into the SQL editor)
-- against a linked/production project. A local `supabase db reset` always
-- starts from a freshly-recreated, empty database, so `auth.users` being
-- non-empty here is a strong signal this connection isn't what it's
-- supposed to be.
do $$
declare
  existing_users int;
begin
  select count(*) into existing_users from auth.users;
  if existing_users > 0 then
    raise exception
      'seed.sql refused to run: auth.users already has % row(s). This '
      'script is only safe against a freshly-reset, empty database — it '
      'creates accounts with a shared, publicly-known password. If this '
      'is truly a local database you want re-seeded, run `supabase db '
      'reset` (which empties it first) rather than re-running this file '
      'directly.', existing_users;
  end if;
end $$;

-- ── Users ──────────────────────────────────────────────────────────────
-- 1 admin, 2 client company owners, 3 VAs (one of each approval_status
-- that matters: approved, pending, rejected).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'admin@virtualbridgeph.com', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"ADMIN","full_name":"Ava Admin"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'owner@acme.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"CLIENT","full_name":"Carla Client"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'owner@globex.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"CLIENT","full_name":"Greg Globex"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'approved.va@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"VA","full_name":"Vera Approved"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'pending.va@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"VA","full_name":"Paolo Pending"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'rejected.va@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"VA","full_name":"Rita Rejected"}', now(), now(), '', '', '', '');

-- The handle_new_user() trigger fires on each insert above and creates the
-- matching profiles (+ va_profiles, for the VAs) rows automatically. From
-- here on we just UPDATE/INSERT the rest of the picture on top of that.

update public.profiles set role = 'ADMIN' where id = 'a0000000-0000-0000-0000-000000000001';

-- ── Clients ────────────────────────────────────────────────────────────

insert into public.clients (id, company_name, billing_email, industry, status) values
  ('b0000000-0000-0000-0000-000000000001', 'Acme Corp', 'billing@acme.test', 'E-commerce', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Globex Inc', 'billing@globex.test', 'SaaS', 'active');

insert into public.client_members (client_id, profile_id, role_in_company) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'owner');

-- ── VA profiles ────────────────────────────────────────────────────────

update public.va_profiles set
  headline = 'Experienced E-commerce VA',
  bio = 'Five years supporting Shopify stores with fulfillment and customer service.',
  skills = array['Shopify', 'Customer Support', 'Email Management'],
  experience_years = 5,
  timezone = 'Asia/Manila',
  approval_status = 'approved',
  approved_by = 'a0000000-0000-0000-0000-000000000001',
  approved_at = now()
where id = '90000000-0000-0000-0000-000000000001';

update public.va_profiles set
  headline = 'Junior Virtual Assistant',
  bio = 'New to VA work, background in admin support.',
  skills = array['Data Entry', 'Scheduling'],
  experience_years = 1,
  timezone = 'Asia/Manila',
  approval_status = 'pending'
where id = '90000000-0000-0000-0000-000000000002';

update public.va_profiles set
  headline = 'General VA',
  approval_status = 'rejected',
  approved_by = 'a0000000-0000-0000-0000-000000000001',
  approved_at = now(),
  rejection_reason = 'Profile incomplete — no verifiable work history.'
where id = '90000000-0000-0000-0000-000000000003';

-- ── Projects ───────────────────────────────────────────────────────────

insert into public.projects (id, client_id, name, description, status) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Customer Support Desk', 'Day-to-day support inbox coverage', 'active'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Lead Gen Campaign', 'Outbound prospecting for Q1', 'active');

-- ── Jobs ───────────────────────────────────────────────────────────────
-- Rates deliberately varied to exercise the generated va_hourly_rate at
-- different margins, including the $2/hr default.

insert into public.jobs (id, client_id, title, description, responsibilities, required_skills, experience_level, hours_per_week, timezone, schedule, client_hourly_rate, agency_margin, num_vas_required, application_deadline, status, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Customer Support VA', 'Handle support tickets via Zendesk.', 'Respond to inbound tickets, triage priority, escalate as needed.', array['Zendesk', 'Customer Service', 'English (written)'], 'INTERMEDIATE', 40, 'Asia/Manila', 'Mon-Fri 9am-6pm PHT',
   6.00, 2.00, 1, '2026-09-30', 'OPEN', 'c0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'Lead Generation Specialist', 'Cold outreach and lead qualification.', 'Prospect leads, run cold outreach sequences, qualify and hand off to sales.', array['B2B Sales', 'Outbound Prospecting', 'CRM'], 'EXPERT', 20, 'America/New_York', 'Flexible, US morning overlap',
   8.50, 2.50, 2, null, 'OPEN', 'c0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'Filled Position (historical)', 'Already-filled role, for testing filled-status visibility.', null, array[]::text[], null, 40, 'Asia/Manila', 'Mon-Fri',
   7.00, 2.00, 1, null, 'FILLED', 'c0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
   'Bookkeeping VA', 'Manage accounts payable/receivable in QuickBooks.', 'Reconcile accounts, process invoices, prepare monthly reports.', array['QuickBooks', 'Bookkeeping', 'Excel'], 'ENTRY', 15, 'Asia/Manila', 'Flexible, 3 mornings/week',
   5.00, 2.00, 1, '2026-10-15', 'OPEN', 'c0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
   'Social Media Manager', 'Own content calendar and engagement across IG/FB/TikTok.', 'Plan and schedule posts, respond to comments/DMs, report on engagement.', array['Social Media', 'Content Creation', 'Canva'], 'INTERMEDIATE', 25, 'Europe/London', 'Flexible, UK afternoon overlap',
   9.00, 2.00, 1, null, 'OPEN', 'c0000000-0000-0000-0000-000000000001');

-- ── Job applications ───────────────────────────────────────────────────

insert into public.job_applications (job_id, va_id, cover_note, relevant_experience, expected_availability, status) values
  ('e0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'I have extensive Zendesk experience.', '3 years running support inboxes for two e-commerce brands.', 'Immediately', 'HIRED'),
  ('e0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'Interested in lead gen work too.', '1 year of B2B cold outreach at a SaaS startup.', '2 weeks notice', 'SUBMITTED');

-- ── Placement ──────────────────────────────────────────────────────────
-- The approved VA is placed on the (now filled) customer support job.
-- Rate snapshotted at placement time — matches the job's rate here, but
-- deliberately stored independently (see the placements migration).

insert into public.placements (id, client_id, va_id, job_id, project_id, client_hourly_rate, agency_margin, hours_per_week_expected, start_date, status) values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 6.00, 2.00, 40, current_date - interval '14 days', 'ACTIVE');

update public.jobs set status = 'FILLED' where id = 'e0000000-0000-0000-0000-000000000001';

-- ── Time tracking ──────────────────────────────────────────────────────
-- One approved time entry (three 10-minute segments, one with a
-- screenshot) and one still-pending entry from yesterday.

insert into public.time_entries (id, placement_id, started_at, ended_at, status, approved_by, approved_at) values
  ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   now() - interval '1 day 30 minutes', now() - interval '1 day', 'approved',
   'a0000000-0000-0000-0000-000000000001', now() - interval '20 hours');

insert into public.time_segments (id, time_entry_id, segment_start, segment_end, activity_percentage) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   now() - interval '1 day 30 minutes', now() - interval '1 day 20 minutes', 92),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   now() - interval '1 day 20 minutes', now() - interval '1 day 10 minutes', 78),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   now() - interval '1 day 10 minutes', now() - interval '1 day', 88);

insert into public.screenshots (time_segment_id, storage_path, captured_at) values
  ('20000000-0000-0000-0000-000000000001', 'screenshots/v0000000-1/2026-01-01-0900.jpg', now() - interval '1 day 25 minutes');

insert into public.time_entries (id, placement_id, started_at, ended_at, status) values
  ('10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
   now() - interval '10 minutes', null, 'pending');

-- ── Invoice ────────────────────────────────────────────────────────────

insert into public.invoices (id, client_id, invoice_number, period_start, period_end, subtotal, total, status, issued_at) values
  ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'INV-2026-0001',
   current_date - interval '7 days', current_date, 180.00, 180.00, 'ISSUED', now() - interval '1 day');

insert into public.invoice_items (invoice_id, placement_id, time_entry_id, description, hours, rate_hour) values
  ('30000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Customer Support VA — week of ' || (current_date - interval '7 days')::date, 30.00, 6.00);

insert into public.payments (invoice_id, amount, provider, status, paid_at) values
  ('30000000-0000-0000-0000-000000000001', 180.00, 'manual', 'pending', null);
