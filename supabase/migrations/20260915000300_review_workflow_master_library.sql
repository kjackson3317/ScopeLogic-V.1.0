-- PREVIEW / NOT APPLIED TO PRODUCTION
-- ScopeLogic review workflow, optional Master Project address fields, and reusable
-- contractor checklist templates. This migration is intentionally staged on the
-- feature branch only until the review workflow is approved.

alter table public.master_projects
  add column if not exists address1 text not null default '',
  add column if not exists address2 text not null default '',
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists postal_code text not null default '';

comment on column public.master_projects.location is
  'Legacy formatted location retained for compatibility. New UI uses optional structured address fields and derives display location.';

create table if not exists public.master_project_review_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  engagement_project_id uuid references public.projects(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  system_name text not null default 'Other',
  topic text not null,
  source_type text not null default 'Other',
  source_reference text not null default '',
  observation text not null,
  snippet_label text not null default '',
  disposition text not null default 'Unreviewed',
  linked_master_finding_id uuid references public.master_project_findings(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint master_project_review_notes_disposition_check check (
    disposition in ('Unreviewed', 'No Action', 'Checklist', 'SLR', 'Linked to SLR')
  )
);

create index if not exists master_project_review_notes_master_idx
  on public.master_project_review_notes(master_project_id, system_name, topic, created_at);
create index if not exists master_project_review_notes_finding_idx
  on public.master_project_review_notes(linked_master_finding_id)
  where linked_master_finding_id is not null;

create table if not exists public.contractor_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  name text not null,
  description text not null default '',
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(owner_id, name)
);

create table if not exists public.contractor_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.contractor_checklist_templates(id) on delete cascade,
  sort_order integer not null default 0,
  category text not null default 'General Requirements',
  system_name text not null default 'General',
  question text not null,
  enabled_by_default boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contractor_checklist_template_items_template_idx
  on public.contractor_checklist_template_items(template_id, sort_order, id);

-- Standalone project checklist items do not require an SLR. A linked finding is
-- optional when the question originated from an SLR. Responses remain separate
-- from the reusable template so project edits never mutate the global template.
create table if not exists public.master_project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  source_template_item_id uuid references public.contractor_checklist_template_items(id) on delete set null,
  linked_master_finding_id uuid references public.master_project_findings(id) on delete set null,
  sort_order integer not null default 0,
  category text not null default 'General Requirements',
  system_name text not null default 'General',
  question text not null,
  status text not null default 'Open',
  response text not null default '',
  response_reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists master_project_checklist_items_master_idx
  on public.master_project_checklist_items(master_project_id, sort_order, id);

alter table public.master_project_review_notes enable row level security;
alter table public.contractor_checklist_templates enable row level security;
alter table public.contractor_checklist_template_items enable row level security;
alter table public.master_project_checklist_items enable row level security;

drop policy if exists master_project_review_notes_workspace_access on public.master_project_review_notes;
create policy master_project_review_notes_workspace_access on public.master_project_review_notes
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_project_id))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and created_by_user_id = (select auth.uid())
  and (select private.can_access_master_project(master_project_id))
  and (
    engagement_project_id is null
    or (select private.can_access_project(engagement_project_id))
  )
);

drop policy if exists contractor_checklist_templates_workspace_access on public.contractor_checklist_templates;
create policy contractor_checklist_templates_workspace_access on public.contractor_checklist_templates
for all to authenticated
using (owner_id = (select private.current_workspace_owner()))
with check (
  owner_id = (select private.current_workspace_owner())
  and created_by_user_id = (select auth.uid())
);

drop policy if exists contractor_checklist_template_items_workspace_access on public.contractor_checklist_template_items;
create policy contractor_checklist_template_items_workspace_access on public.contractor_checklist_template_items
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and exists (
    select 1
    from public.contractor_checklist_templates template
    where template.id = template_id
      and template.owner_id = (select private.current_workspace_owner())
  )
)
with check (
  owner_id = (select private.current_workspace_owner())
  and exists (
    select 1
    from public.contractor_checklist_templates template
    where template.id = template_id
      and template.owner_id = (select private.current_workspace_owner())
  )
);

drop policy if exists master_project_checklist_items_workspace_access on public.master_project_checklist_items;
create policy master_project_checklist_items_workspace_access on public.master_project_checklist_items
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_project_id))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and created_by_user_id = (select auth.uid())
  and (select private.can_access_master_project(master_project_id))
);

grant select, insert, update, delete on public.master_project_review_notes to authenticated;
grant select, insert, update, delete on public.contractor_checklist_templates to authenticated;
grant select, insert, update, delete on public.contractor_checklist_template_items to authenticated;
grant select, insert, update, delete on public.master_project_checklist_items to authenticated;

-- Default template seed is intentionally not inserted here. The application will
-- create/copy the standard pack only after user approval so migrations never
-- overwrite an organization's customized template library.
