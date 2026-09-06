-- ScopeLogic v1.0 RC5.7
-- Master Project / Client Engagement hierarchy and workspace-aware access.
-- Backward compatible with the RC5.6 flat-project application: existing projects remain
-- the engagement records and are backfilled into one Master Project each.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace identity helpers
-- ---------------------------------------------------------------------------

create or replace function private.current_workspace_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.workspace_owner_id from public.profiles p where p.id = (select auth.uid())),
    (select auth.uid())
  );
$$;

create or replace function private.current_is_workspace_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.role in ('administrator', 'manager')
    from public.profiles p
    where p.id = (select auth.uid())
  ), false);
$$;

create or replace function private.is_workspace_member(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user
      and p.workspace_owner_id = (select private.current_workspace_owner())
  );
$$;

revoke all on function private.current_workspace_owner() from public, anon;
revoke all on function private.current_is_workspace_admin() from public, anon;
revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.current_workspace_owner() to authenticated;
grant execute on function private.current_is_workspace_admin() to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Master Project hierarchy
-- ---------------------------------------------------------------------------

create table if not exists public.master_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  legacy_id text,
  name text not null,
  project_number text not null default '',
  location text not null default '',
  status text not null default 'Planning',
  version_date date,
  revision text not null default 'Rev 0',
  systems jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

alter table public.projects
  add column if not exists master_project_id uuid references public.master_projects(id) on delete restrict,
  add column if not exists engagement_label text not null default 'Client Engagement',
  add column if not exists engagement_type text not null default 'Product 1',
  add column if not exists is_quick_review boolean not null default false;

create index if not exists projects_master_project_id_idx on public.projects(master_project_id);
create index if not exists master_projects_owner_idx on public.master_projects(owner_id);
create index if not exists master_projects_created_by_idx on public.master_projects(created_by_user_id);

-- One safe Master Project per existing flat project. This preserves every existing
-- project ID, quote, release, document, SLR, contract, and historical relationship.
insert into public.master_projects (
  owner_id, created_by_user_id, legacy_id, name, status, version_date, revision, systems, notes
)
select
  p.owner_id,
  p.assigned_user_id,
  'backfill:' || p.id::text,
  p.name,
  p.status,
  p.version_date,
  p.revision,
  coalesce((select jsonb_agg(ps.system_name order by ps.system_name) from public.project_systems ps where ps.project_id = p.id), '[]'::jsonb),
  ''
from public.projects p
where p.master_project_id is null
on conflict (owner_id, legacy_id) do nothing;

update public.projects p
set master_project_id = mp.id
from public.master_projects mp
where p.master_project_id is null
  and mp.owner_id = p.owner_id
  and mp.legacy_id = 'backfill:' || p.id::text;

alter table public.projects alter column master_project_id set not null;

comment on table public.master_projects is
  'Reusable project baseline shared across one or more confidential Client Engagement records.';
comment on column public.projects.master_project_id is
  'Parent Master Project. The projects table remains the private Client Engagement record for backward compatibility.';
comment on column public.projects.engagement_type is
  'ScopeLogic product selected for this Client Engagement: Product 1, Product 2, Product 3, Product 4, or Quick Review.';

-- Shared Master Project source documents. These are deliberately separate from
-- project_documents, which remains private to a Client Engagement.
create table if not exists public.master_project_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  legacy_id text,
  document_type text not null,
  display_name text not null,
  revision text not null default 'Revision 0',
  issue_date date,
  is_current boolean not null default true,
  notes text not null default '',
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, master_project_id, legacy_id)
);

create index if not exists master_project_documents_master_idx
  on public.master_project_documents(master_project_id);

-- Shared baseline findings. GC-specific responses, pricing, and strategy stay in
-- engagement-scoped SLRs/quotes and must never be copied between engagements.
create table if not exists public.master_project_findings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  legacy_uid text,
  sequence_number integer not null,
  display_number text not null,
  systems jsonb not null default '[]'::jsonb,
  scope_item text not null,
  scope_concern text not null default '',
  recommended_bid_basis_by_system jsonb not null default '{}'::jsonb,
  rfi_question text not null default '',
  reason_basis text not null default '',
  reference text not null default '',
  source_type text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, master_project_id, sequence_number)
);

create index if not exists master_project_findings_master_idx
  on public.master_project_findings(master_project_id, sequence_number);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create or replace function private.can_access_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project
      and p.owner_id = (select private.current_workspace_owner())
      and (
        (select private.current_is_workspace_admin())
        or p.assigned_user_id = (select auth.uid())
      )
  );
$$;

create or replace function private.can_access_master_project(target_master uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.master_projects mp
    where mp.id = target_master
      and mp.owner_id = (select private.current_workspace_owner())
      and (
        (select private.current_is_workspace_admin())
        or mp.created_by_user_id = (select auth.uid())
        or exists (
          select 1 from public.projects p
          where p.master_project_id = mp.id
            and p.assigned_user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_access_release(target_release uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.release_packages rp
    where rp.id = target_release
      and rp.owner_id = (select private.current_workspace_owner())
      and (select private.can_access_project(rp.project_id))
  );
$$;

create or replace function private.can_access_project_legacy(target_legacy text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.owner_id = (select private.current_workspace_owner())
      and p.legacy_id = target_legacy
      and (select private.can_access_project(p.id))
  );
$$;

revoke all on function private.can_access_project(uuid) from public, anon;
revoke all on function private.can_access_master_project(uuid) from public, anon;
revoke all on function private.can_access_release(uuid) from public, anon;
revoke all on function private.can_access_project_legacy(text) from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated;
grant execute on function private.can_access_master_project(uuid) to authenticated;
grant execute on function private.can_access_release(uuid) to authenticated;
grant execute on function private.can_access_project_legacy(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Master Project RLS
-- ---------------------------------------------------------------------------

alter table public.master_projects enable row level security;
alter table public.master_project_documents enable row level security;
alter table public.master_project_findings enable row level security;

drop policy if exists master_projects_workspace_access on public.master_projects;
create policy master_projects_workspace_access on public.master_projects
for select to authenticated
using ((select private.can_access_master_project(id)));

drop policy if exists master_projects_workspace_insert on public.master_projects;
create policy master_projects_workspace_insert on public.master_projects
for insert to authenticated
with check (
  owner_id = (select private.current_workspace_owner())
  and created_by_user_id = (select auth.uid())
);

drop policy if exists master_projects_workspace_update on public.master_projects;
create policy master_projects_workspace_update on public.master_projects
for update to authenticated
using ((select private.can_access_master_project(id)))
with check (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
  )
);

drop policy if exists master_projects_workspace_delete on public.master_projects;
create policy master_projects_workspace_delete on public.master_projects
for delete to authenticated
using (
  (select private.can_access_master_project(id))
  and not exists (select 1 from public.projects p where p.master_project_id = id)
);

for select, insert, update, delete on public.master_projects to authenticated;
grant select, insert, update, delete on public.master_project_documents to authenticated;
grant select, insert, update, delete on public.master_project_findings to authenticated;

drop policy if exists master_project_documents_workspace_access on public.master_project_documents;
create policy master_project_documents_workspace_access on public.master_project_documents
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_project_id))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_project_id))
);

drop policy if exists master_project_findings_workspace_access on public.master_project_findings;
create policy master_project_findings_workspace_access on public.master_project_findings
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_project_id))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_project_id))
);

-- ---------------------------------------------------------------------------
-- Workspace-aware RLS for the existing engagement application
-- ---------------------------------------------------------------------------

-- Administrators can see every project in the workspace. Standard users see only
-- the projects assigned to their own library.
drop policy if exists projects_manage_own on public.projects;
drop policy if exists projects_workspace_access on public.projects;
create policy projects_workspace_access on public.projects
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or assigned_user_id = (select auth.uid())
  )
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (
    assigned_user_id = (select auth.uid())
    or (
      (select private.current_is_workspace_admin())
      and (select private.is_workspace_member(assigned_user_id))
    )
  )
);

-- Workspace address book and reusable SLR templates are shared libraries.
drop policy if exists customers_manage_own on public.customers;
create policy customers_workspace_access on public.customers
for all to authenticated
using (owner_id = (select private.current_workspace_owner()))
with check (owner_id = (select private.current_workspace_owner()));

drop policy if exists contacts_manage_own on public.contacts;
create policy contacts_workspace_access on public.contacts
for all to authenticated
using (owner_id = (select private.current_workspace_owner()))
with check (owner_id = (select private.current_workspace_owner()));

drop policy if exists slr_templates_manage_own on public.slr_templates;
create policy slr_templates_workspace_access on public.slr_templates
for all to authenticated
using (owner_id = (select private.current_workspace_owner()))
with check (owner_id = (select private.current_workspace_owner()));

-- Project-scoped records follow the project assignment boundary.
drop policy if exists project_systems_manage_own on public.project_systems;
create policy project_systems_workspace_access on public.project_systems
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists project_contacts_manage_own on public.project_contacts;
create policy project_contacts_workspace_access on public.project_contacts
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_project(project_id))
  and exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = (select private.current_workspace_owner()))
);

drop policy if exists slr_entries_manage_own_project on public.slr_entries;
create policy slr_entries_workspace_access on public.slr_entries
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists project_documents_manage_own_project on public.project_documents;
create policy project_documents_workspace_access on public.project_documents
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists calendar_events_manage_own on public.calendar_events;
create policy calendar_events_workspace_access on public.calendar_events
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (project_id is null or (select private.can_access_project(project_id)))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (project_id is null or (select private.can_access_project(project_id)))
);

drop policy if exists contracts_manage_own_project on public.contracts;
create policy contracts_workspace_access on public.contracts
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists internal_notes_manage_own_project on public.internal_notes;
create policy internal_notes_workspace_access on public.internal_notes
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists export_log_manage_own_project on public.export_log;
create policy export_log_workspace_access on public.export_log
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists release_packages_manage_own_project on public.release_packages;
create policy release_packages_workspace_access on public.release_packages
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_project(project_id)));

drop policy if exists release_deliverables_manage_own on public.release_deliverables;
create policy release_deliverables_workspace_access on public.release_deliverables
for all to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_release(release_package_id)))
with check (owner_id = (select private.current_workspace_owner()) and (select private.can_access_release(release_package_id)));

drop policy if exists "Owners read release quote revisions" on public.release_quote_revisions;
drop policy if exists release_quote_revisions_workspace_read on public.release_quote_revisions;
create policy release_quote_revisions_workspace_read on public.release_quote_revisions
for select to authenticated
using (owner_id = (select private.current_workspace_owner()) and (select private.can_access_release(release_package_id)));

-- The current RC5.7 browser client reads the workspace owner's settings record.
-- This is the shared workspace metadata record; project confidentiality remains in
-- the project-scoped policies above.
drop policy if exists user_settings_manage_self on public.user_settings;
drop policy if exists user_settings_workspace_access on public.user_settings;
create policy user_settings_workspace_access on public.user_settings
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and user_id = (select private.current_workspace_owner())
)
with check (
  owner_id = (select private.current_workspace_owner())
  and user_id = (select private.current_workspace_owner())
);

-- Profile visibility: users can read themselves; workspace administrators can read
-- workspace members so projects can be assigned to subordinate libraries.
drop policy if exists profiles_read_self on public.profiles;
drop policy if exists profiles_read_workspace on public.profiles;
create policy profiles_read_workspace on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    (select private.current_is_workspace_admin())
    and workspace_owner_id = (select private.current_workspace_owner())
  )
);

-- ---------------------------------------------------------------------------
-- Private file storage follows the same project-assignment boundary.
-- ---------------------------------------------------------------------------

drop policy if exists project_files_select_own on storage.objects;
drop policy if exists project_files_insert_own on storage.objects;
drop policy if exists project_files_update_own on storage.objects;
drop policy if exists project_files_delete_own on storage.objects;

create policy project_files_select_workspace on storage.objects
for select to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select private.current_workspace_owner())::text
  and (select private.can_access_project_legacy((storage.foldername(name))[2]))
);

create policy project_files_insert_workspace on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select private.current_workspace_owner())::text
  and (select private.can_access_project_legacy((storage.foldername(name))[2]))
);

create policy project_files_update_workspace on storage.objects
for update to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select private.current_workspace_owner())::text
  and (select private.can_access_project_legacy((storage.foldername(name))[2]))
  and not is_immutable_release_object(name)
)
with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select private.current_workspace_owner())::text
  and (select private.can_access_project_legacy((storage.foldername(name))[2]))
  and not is_immutable_release_object(name)
);

create policy project_files_delete_workspace on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select private.current_workspace_owner())::text
  and (select private.can_access_project_legacy((storage.foldername(name))[2]))
  and not is_immutable_release_object(name)
);

notify pgrst, 'reload schema';
