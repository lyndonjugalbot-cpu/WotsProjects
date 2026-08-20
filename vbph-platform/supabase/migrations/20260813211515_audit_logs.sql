-- Append-only audit trail. Any authenticated user can create an entry
-- attributed to themselves (e.g. "VA deleted screenshot X"); only admin
-- can read the log. No UPDATE/DELETE grant for non-admins at all — once
-- written, a regular user cannot alter or remove their own entries.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_insert_self" on public.audit_logs
  for insert with check (actor_id = auth.uid());

create policy "audit_logs_admin_all" on public.audit_logs
  for all using (public.is_admin())
  with check (public.is_admin());
