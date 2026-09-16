-- ScopeLogic production review-deliverables workflow.
-- Adds structured Review Notes, independent SLR child/action records,
-- contractor checklist items, and bid-alignment working records.

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

create table if not exists public.master_project_deliverable_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  related_master_finding_id uuid references public.master_project_findings(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  deliverable_type text not null,
  sequence_number integer not null,
  display_number text not null,
  system_name text not null default 'Other',
  title text not null,
  content text not null default '',
  impact_considerations text not null default '',
  reference text not null default '',
  status text not null default 'Draft',
  response text not null default '',
  response_date date,
  response_source text not null default '',
  client_facing boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint master_project_deliverable_type_check check (
    deliverable_type in ('RBB', 'CL', 'RFI', 'VE', 'SLC')
  ),
  unique(master_project_id, deliverable_type, sequence_number),
  unique(master_project_id, display_number)
);

create index if not exists master_project_deliverable_items_master_idx
  on public.master_project_deliverable_items(master_project_id, deliverable_type, sequence_number);
create index if not exists master_project_deliverable_items_finding_idx
  on public.master_project_deliverable_items(related_master_finding_id)
  where related_master_finding_id is not null;

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

create table if not exists public.master_project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  source_template_item_id uuid references public.contractor_checklist_template_items(id) on delete set null,
  linked_master_finding_id uuid references public.master_project_findings(id) on delete set null,
  sequence_number integer not null,
  display_number text not null,
  sort_order integer not null default 0,
  category text not null default 'General Requirements',
  system_name text not null default 'General',
  question text not null,
  status text not null default 'Open',
  response text not null default '',
  response_reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(master_project_id, sequence_number),
  unique(master_project_id, display_number)
);

create index if not exists master_project_checklist_items_master_idx
  on public.master_project_checklist_items(master_project_id, sequence_number, id);

create table if not exists public.master_project_bid_alignment_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  related_deliverable_id uuid references public.master_project_deliverable_items(id) on delete set null,
  bidder_name text not null,
  scope_item text not null,
  proposal_status text not null default 'Unclear',
  proposal_reference text not null default '',
  clarification text not null default '',
  documented_adjustment numeric,
  adjustment_type text not null default 'None',
  pricing_source text not null default '',
  internal_notes text not null default '',
  client_notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint master_project_bid_alignment_status_check check (
    proposal_status in ('Included', 'Excluded', 'Qualified', 'Unclear')
  ),
  constraint master_project_bid_alignment_adjustment_check check (
    adjustment_type in ('None', 'Add', 'Deduct')
  )
);

create index if not exists master_project_bid_alignment_master_idx
  on public.master_project_bid_alignment_items(master_project_id, bidder_name, sort_order, id);

alter table public.master_project_review_notes enable row level security;
alter table public.master_project_deliverable_items enable row level security;
alter table public.contractor_checklist_templates enable row level security;
alter table public.contractor_checklist_template_items enable row level security;
alter table public.master_project_checklist_items enable row level security;
alter table public.master_project_bid_alignment_items enable row level security;

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

drop policy if exists master_project_deliverable_items_workspace_access on public.master_project_deliverable_items;
create policy master_project_deliverable_items_workspace_access on public.master_project_deliverable_items
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

drop policy if exists master_project_bid_alignment_items_workspace_access on public.master_project_bid_alignment_items;
create policy master_project_bid_alignment_items_workspace_access on public.master_project_bid_alignment_items
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
grant select, insert, update, delete on public.master_project_deliverable_items to authenticated;
grant select, insert, update, delete on public.contractor_checklist_templates to authenticated;
grant select, insert, update, delete on public.contractor_checklist_template_items to authenticated;
grant select, insert, update, delete on public.master_project_checklist_items to authenticated;
grant select, insert, update, delete on public.master_project_bid_alignment_items to authenticated;

-- Backfill current SLR-derived RBB, RFI and contractor confirmation data once.
with ranked as (
  select f.*,
         row_number() over (partition by f.master_project_id order by f.sequence_number, f.id) as seq
  from public.master_project_findings f
  where coalesce(trim(f.recommended_bid_basis), '') <> ''
    and coalesce(f.status, '') <> 'Closed'
)
insert into public.master_project_deliverable_items (
  owner_id, master_project_id, related_master_finding_id, created_by_user_id,
  deliverable_type, sequence_number, display_number, system_name, title, content,
  reference, status, client_facing, sort_order
)
select owner_id, master_project_id, id, owner_id,
       'RBB', seq, 'RBB-' || lpad(seq::text, 3, '0'),
       coalesce(nullif(systems->>0, ''), 'Other'), scope_item, recommended_bid_basis,
       reference, 'Current', true, sequence_number
from ranked
on conflict (master_project_id, display_number) do nothing;

with ranked as (
  select f.*,
         row_number() over (partition by f.master_project_id order by f.sequence_number, f.id) as seq
  from public.master_project_findings f
  where f.include_formal_rfi = true
    and coalesce(trim(f.rfi_question), '') <> ''
    and coalesce(f.status, '') <> 'Closed'
)
insert into public.master_project_deliverable_items (
  owner_id, master_project_id, related_master_finding_id, created_by_user_id,
  deliverable_type, sequence_number, display_number, system_name, title, content,
  reference, status, client_facing, sort_order
)
select owner_id, master_project_id, id, owner_id,
       'RFI', seq, 'RFI-' || lpad(seq::text, 3, '0'),
       coalesce(nullif(systems->>0, ''), 'Other'), scope_item, rfi_question,
       reference, 'Draft', true, sequence_number
from ranked
on conflict (master_project_id, display_number) do nothing;

with ranked as (
  select f.*,
         row_number() over (partition by f.master_project_id order by f.sequence_number, f.id) as seq
  from public.master_project_findings f
  where coalesce(trim(f.checklist_scope_item), '') <> ''
    and coalesce(f.status, '') <> 'Closed'
)
insert into public.master_project_checklist_items (
  owner_id, master_project_id, created_by_user_id, linked_master_finding_id,
  sequence_number, display_number, sort_order, category, system_name, question, status
)
select owner_id, master_project_id, owner_id, id,
       seq, 'CSC-' || lpad(seq::text, 3, '0'), sequence_number,
       'Project-Specific', coalesce(nullif(systems->>0, ''), 'General'), checklist_scope_item, 'Open'
from ranked
on conflict (master_project_id, display_number) do nothing;
