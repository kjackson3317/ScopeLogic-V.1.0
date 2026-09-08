-- PROPOSED ONLY — DO NOT APPLY TO PRODUCTION.
-- ScopeLogic CRM MVP schema draft for feature/crm-mvp-preview.
-- The preview UI intentionally uses browser-local data only.

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  primary_contact_id uuid references public.contacts(id) on delete set null,
  master_project_id uuid references public.master_projects(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  assigned_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  name text not null,
  stage text not null default 'Lead',
  offering text not null default 'Both',
  estimated_value numeric(14,2) not null default 0,
  probability integer not null default 10 check (probability between 0 and 100),
  expected_close date,
  source text not null default '',
  last_activity_at timestamptz,
  next_action text not null default '',
  next_action_date date,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (stage in ('Lead','Ready to Contact','Contacted','Responded','Qualified','Project Received','SOW Sent','Contract / Vendor Setup','Won','Lost / Dormant')),
  check (offering in ('Quick Review','Large Project','Both'))
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  activity_type text not null default 'Note',
  activity_at timestamptz not null default timezone('utc', now()),
  summary text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (activity_type in ('Email','Call','Meeting','Note','Document'))
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  assigned_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  title text not null,
  due_date date not null,
  priority text not null default 'Normal',
  status text not null default 'Open',
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (priority in ('Normal','High')),
  check (status in ('Open','Complete'))
);

alter table public.customers
  add column if not exists crm_status text not null default 'Prospect',
  add column if not exists project_mix text not null default 'Both',
  add column if not exists last_activity_at timestamptz,
  add column if not exists next_follow_up date;

alter table public.contacts
  add column if not exists crm_role text not null default '',
  add column if not exists decision_influence text not null default 'Unknown';

create index if not exists crm_opportunities_owner_stage_idx on public.crm_opportunities(owner_id, stage);
create index if not exists crm_opportunities_customer_idx on public.crm_opportunities(customer_id);
create index if not exists crm_tasks_owner_due_idx on public.crm_tasks(owner_id, status, due_date);
create index if not exists crm_activities_customer_date_idx on public.crm_activities(customer_id, activity_at desc);

alter table public.crm_opportunities enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks enable row level security;

-- Proposed access model: CRM is workspace-scoped. Administrators/managers can see
-- all CRM records in the workspace; subordinate users see records assigned to them.
-- Final RLS should be reviewed against the RC5.7 workspace rules before migration.

drop policy if exists crm_opportunities_read on public.crm_opportunities;
create policy crm_opportunities_read on public.crm_opportunities
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
);

drop policy if exists crm_opportunities_write on public.crm_opportunities;
create policy crm_opportunities_write on public.crm_opportunities
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
);

drop policy if exists crm_activities_read on public.crm_activities;
create policy crm_activities_read on public.crm_activities
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
    or exists (
      select 1 from public.crm_opportunities o
      where o.id = crm_activities.opportunity_id
        and o.assigned_user_id = (select auth.uid())
    )
  )
);

drop policy if exists crm_activities_write on public.crm_activities;
create policy crm_activities_write on public.crm_activities
for all to authenticated
using (owner_id = (select private.current_workspace_owner()))
with check (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
  )
);

drop policy if exists crm_tasks_read on public.crm_tasks;
create policy crm_tasks_read on public.crm_tasks
for select to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
);

drop policy if exists crm_tasks_write on public.crm_tasks;
create policy crm_tasks_write on public.crm_tasks
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and ((select private.current_is_workspace_admin()) or assigned_user_id = (select auth.uid()))
);

-- Deliberately omitted from this proposed file:
-- GRANT statements, PostgREST schema reload, and any production migration history.
-- Those should be added only after preview acceptance and a final security review.
