alter table public.customers
  add column if not exists crm_status text not null default 'Prospect';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customers_crm_status_check'
  ) then
    alter table public.customers
      add constraint customers_crm_status_check
      check (crm_status in ('Prospect','Active Client','Past Client','Dormant'));
  end if;
end $$;

create table if not exists public.crm_communications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.current_workspace_owner() references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  communication_type text not null default 'Email',
  direction text not null default 'Outgoing',
  communication_date date not null default current_date,
  subject text not null default '',
  summary text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_communications_type_check check (communication_type in ('Email','Call','Teams','Meeting','Text','Document','Note')),
  constraint crm_communications_direction_check check (direction in ('Outgoing','Incoming','Internal'))
);

create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.current_workspace_owner() references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  assigned_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  title text not null,
  due_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.current_workspace_owner() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  invoice_number text not null,
  amount numeric(14,2) not null check (amount >= 0),
  issued_date date not null default current_date,
  due_date date not null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(owner_id, invoice_number)
);

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.current_workspace_owner() references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.crm_invoices(id) on delete cascade,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  reference text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_communications_owner_idx on public.crm_communications(owner_id);
create index if not exists crm_communications_customer_date_idx on public.crm_communications(customer_id, communication_date desc);
create index if not exists crm_communications_project_date_idx on public.crm_communications(project_id, communication_date desc) where project_id is not null;
create index if not exists crm_communications_contact_idx on public.crm_communications(contact_id) where contact_id is not null;
create index if not exists crm_communications_created_by_idx on public.crm_communications(created_by_user_id);
create index if not exists crm_followups_owner_due_idx on public.crm_followups(owner_id, completed_at, due_date);
create index if not exists crm_followups_customer_due_idx on public.crm_followups(customer_id, due_date);
create index if not exists crm_followups_project_idx on public.crm_followups(project_id) where project_id is not null;
create index if not exists crm_followups_contact_idx on public.crm_followups(contact_id) where contact_id is not null;
create index if not exists crm_followups_created_by_idx on public.crm_followups(created_by_user_id);
create index if not exists crm_followups_assigned_user_idx on public.crm_followups(assigned_user_id, completed_at, due_date);
create index if not exists crm_invoices_owner_idx on public.crm_invoices(owner_id);
create index if not exists crm_invoices_project_due_idx on public.crm_invoices(project_id, due_date);
create index if not exists crm_invoices_created_by_idx on public.crm_invoices(created_by_user_id);
create index if not exists crm_payments_owner_idx on public.crm_payments(owner_id);
create index if not exists crm_payments_invoice_date_idx on public.crm_payments(invoice_id, payment_date desc);
create index if not exists crm_payments_created_by_idx on public.crm_payments(created_by_user_id);

alter table public.crm_communications enable row level security;
alter table public.crm_followups enable row level security;
alter table public.crm_invoices enable row level security;
alter table public.crm_payments enable row level security;

drop policy if exists crm_communications_workspace_access on public.crm_communications;
create policy crm_communications_workspace_access on public.crm_communications
for all to authenticated
using (owner_id = (select private.current_workspace_owner()))
with check (owner_id = (select private.current_workspace_owner()));

drop policy if exists crm_followups_read on public.crm_followups;
create policy crm_followups_read on public.crm_followups
for select to authenticated
using (owner_id = (select private.current_workspace_owner()) and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid())));

drop policy if exists crm_followups_write on public.crm_followups;
create policy crm_followups_write on public.crm_followups
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid())))
with check (owner_id = (select private.current_workspace_owner()) and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid())));

drop policy if exists crm_invoices_project_access on public.crm_invoices;
create policy crm_invoices_project_access on public.crm_invoices
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists crm_payments_project_access on public.crm_payments;
create policy crm_payments_project_access on public.crm_payments
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and exists (
    select 1 from public.crm_invoices i
    where i.id = crm_payments.invoice_id
      and i.owner_id = (select private.current_workspace_owner())
      and (select private.can_access_project(i.project_id))
  )
)
with check (
  owner_id = (select private.current_workspace_owner())
  and exists (
    select 1 from public.crm_invoices i
    where i.id = crm_payments.invoice_id
      and i.owner_id = (select private.current_workspace_owner())
      and (select private.can_access_project(i.project_id))
  )
);

grant select, insert, update, delete on public.crm_communications to authenticated;
grant select, insert, update, delete on public.crm_followups to authenticated;
grant select, insert, update, delete on public.crm_invoices to authenticated;
grant select, insert, update, delete on public.crm_payments to authenticated;
