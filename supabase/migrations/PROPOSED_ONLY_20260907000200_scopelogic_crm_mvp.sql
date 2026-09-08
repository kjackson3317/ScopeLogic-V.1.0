-- PROPOSED ONLY — DO NOT APPLY TO PRODUCTION.
-- ScopeLogic Client CRM schema draft for feature/crm-mvp-preview.
-- The preview UI intentionally uses browser-local data only.
--
-- Design principle:
--   customers + contacts + existing projects remain the source of truth.
--   CRM adds communication history, follow-ups, invoices, and payments.
--   There is intentionally NO opportunity pipeline, probability, forecast value,
--   expected close date, or weighted sales pipeline.

alter table public.customers
  add column if not exists relationship_status text not null default 'Prospect',
  add column if not exists relationship_notes text not null default '',
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_follow_up date;

alter table public.customers
  drop constraint if exists customers_relationship_status_check;
alter table public.customers
  add constraint customers_relationship_status_check
  check (relationship_status in ('Prospect','Active Client','Past Client','Dormant'));

create table if not exists public.crm_communications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  communication_type text not null default 'Note',
  direction text not null default 'Internal',
  communication_at timestamptz not null default timezone('utc', now()),
  subject text not null default '',
  summary text not null,
  source_reference text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  check (communication_type in ('Email','Call','Teams','Meeting','Text','Document','Note')),
  check (direction in ('Outgoing','Incoming','Internal'))
);

create table if not exists public.crm_follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assigned_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  title text not null,
  due_date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  invoice_number text not null,
  amount numeric(14,2) not null check (amount >= 0),
  issued_date date not null,
  due_date date not null,
  notes text not null default '',
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, invoice_number)
);

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.crm_invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  payment_reference text not null default '',
  notes text not null default '',
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_communications_customer_date_idx
  on public.crm_communications(customer_id, communication_at desc);
create index if not exists crm_communications_project_date_idx
  on public.crm_communications(project_id, communication_at desc)
  where project_id is not null;
create index if not exists crm_follow_ups_owner_due_idx
  on public.crm_follow_ups(owner_id, completed, due_date);
create index if not exists crm_invoices_project_idx
  on public.crm_invoices(project_id, issued_date desc);
create index if not exists crm_invoices_owner_due_idx
  on public.crm_invoices(owner_id, due_date);
create index if not exists crm_payments_invoice_date_idx
  on public.crm_payments(invoice_id, payment_date desc);

alter table public.crm_communications enable row level security;
alter table public.crm_follow_ups enable row level security;
alter table public.crm_invoices enable row level security;
alter table public.crm_payments enable row level security;

-- Proposed access model:
-- Workspace administrators/managers see all client relationship records.
-- Subordinate users see communications/follow-ups tied to projects they can access,
-- records they created/are assigned, and invoice/payment records for accessible projects.
-- Final policies must be validated against RC5.7 before any migration is applied.

drop policy if exists crm_communications_read on public.crm_communications;
create policy crm_communications_read on public.crm_communications
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
    or (project_id is not null and (select private.can_access_project(project_id)))
  )
);

drop policy if exists crm_communications_write on public.crm_communications;
create policy crm_communications_write on public.crm_communications
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
    or (project_id is not null and (select private.can_access_project(project_id)))
  )
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
    or (project_id is not null and (select private.can_access_project(project_id)))
  )
);

drop policy if exists crm_follow_ups_read on public.crm_follow_ups;
create policy crm_follow_ups_read on public.crm_follow_ups
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or assigned_user_id = (select auth.uid())
    or (project_id is not null and (select private.can_access_project(project_id)))
  )
);

drop policy if exists crm_follow_ups_write on public.crm_follow_ups;
create policy crm_follow_ups_write on public.crm_follow_ups
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
);

drop policy if exists crm_invoices_read on public.crm_invoices;
create policy crm_invoices_read on public.crm_invoices
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or (select private.can_access_project(project_id)))
);

drop policy if exists crm_invoices_write on public.crm_invoices;
create policy crm_invoices_write on public.crm_invoices
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or (select private.can_access_project(project_id)))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or (select private.can_access_project(project_id)))
);

drop policy if exists crm_payments_read on public.crm_payments;
create policy crm_payments_read on public.crm_payments
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or exists (
      select 1 from public.crm_invoices i
      where i.id = crm_payments.invoice_id
        and (select private.can_access_project(i.project_id))
    )
  )
);

drop policy if exists crm_payments_write on public.crm_payments;
create policy crm_payments_write on public.crm_payments
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or exists (
      select 1 from public.crm_invoices i
      where i.id = crm_payments.invoice_id
        and (select private.can_access_project(i.project_id))
    )
  )
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or exists (
      select 1 from public.crm_invoices i
      where i.id = crm_payments.invoice_id
        and (select private.can_access_project(i.project_id))
    )
  )
);

-- Deliberately omitted from this proposed file:
-- GRANT statements, PostgREST reload, changes to production migration history,
-- or any execution against the live Supabase project.
