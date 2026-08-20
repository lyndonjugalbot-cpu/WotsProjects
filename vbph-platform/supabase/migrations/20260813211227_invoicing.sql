-- Invoices, invoice line items, and payments. Invoices are client-facing
-- documents — showing a client their own hourly rate on their own invoice
-- is correct and expected; this is not a rate-privacy boundary the way
-- jobs/placements are. Invoice generation itself (turning approved
-- time_entries into line items) is an admin/system operation — clients get
-- read-only access.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  invoice_number text not null unique,
  period_start date not null,
  period_end date not null,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_period_valid check (period_end >= period_start)
);

-- One line per placement (or per time_entry, if billed individually) on an
-- invoice. rate_hour here is the CLIENT rate — this table is only ever
-- read by the client it belongs to (or admin), so that's the correct rate
-- to show, unlike jobs/placements.
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  placement_id uuid not null references public.placements (id) on delete restrict,
  time_entry_id uuid references public.time_entries (id) on delete set null,
  description text,
  hours numeric(6, 2) not null check (hours >= 0),
  rate_hour numeric(10, 2) not null check (rate_hour >= 0),
  amount numeric(12, 2) generated always as (hours * rate_hour) stored,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  provider text not null default 'manual' check (provider in ('manual', 'stripe', 'paypal', 'wise')),
  provider_reference text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create or replace function public.client_owns_invoice(target_invoice_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select public.is_client_member(client_id) from public.invoices where id = target_invoice_id),
    false
  );
$$;

-- RLS ---------------------------------------------------------------------

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy "invoices_select_member" on public.invoices
  for select using (public.is_client_member(client_id));

create policy "invoices_admin_all" on public.invoices
  for all using (public.is_admin())
  with check (public.is_admin());

create policy "invoice_items_select_member" on public.invoice_items
  for select using (public.client_owns_invoice(invoice_id));

create policy "invoice_items_admin_all" on public.invoice_items
  for all using (public.is_admin())
  with check (public.is_admin());

create policy "payments_select_member" on public.payments
  for select using (public.client_owns_invoice(invoice_id));

create policy "payments_admin_all" on public.payments
  for all using (public.is_admin())
  with check (public.is_admin());
