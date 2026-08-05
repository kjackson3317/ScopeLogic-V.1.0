-- ScopeLogic v1.0 RC3.1 — production schema repair and cloud diagnostics
-- This migration is intentionally idempotent. It repairs database drift without deleting application records.

create extension if not exists pgcrypto;

-- Core project relationship required by the RC3 cloud workspace.
alter table if exists public.projects
  add column if not exists client_name text not null default '',
  add column if not exists customer_id uuid,
  add column if not exists version_date date,
  add column if not exists status text not null default 'Planning',
  add column if not exists revision text not null default 'Rev 0',
  add column if not exists modified_label text not null default '',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Remove invalid legacy references before adding the foreign key.
update public.projects p
set customer_id = null
where customer_id is not null
  and not exists (select 1 from public.customers c where c.id = p.customer_id);

do $$
begin
  if to_regclass('public.projects') is not null
     and to_regclass('public.customers') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.projects'::regclass
         and conname = 'projects_customer_id_fkey'
     ) then
    alter table public.projects
      add constraint projects_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null;
  end if;
end $$;

-- Columns required by the browser-to-cloud cutover state machine.
alter table if exists public.user_settings
  add column if not exists email_settings jsonb not null default '{}'::jsonb,
  add column if not exists selected_project_legacy_id text,
  add column if not exists data_mode text not null default 'cloud',
  add column if not exists cloud_revision bigint not null default 0,
  add column if not exists last_cloud_sync_at timestamptz,
  add column if not exists cloud_cutover_completed_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Keep the data-mode constraint correct even if an earlier hand repair created the column without it.
alter table if exists public.user_settings
  drop constraint if exists user_settings_data_mode_check;
alter table if exists public.user_settings
  add constraint user_settings_data_mode_check
  check (data_mode in ('cloud', 'local-fallback'));

-- Document metadata required for private Supabase Storage.
alter table if exists public.project_documents
  add column if not exists legacy_id text,
  add column if not exists original_filename text not null default 'document',
  add column if not exists mime_type text not null default 'application/octet-stream',
  add column if not exists size_bytes bigint not null default 0,
  add column if not exists storage_path text,
  add column if not exists storage_migrated_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Ensure every upsert target used by ScopeLogic has a matching uniqueness rule.
create unique index if not exists customers_owner_legacy_uidx
  on public.customers(owner_id, legacy_id);
create unique index if not exists contacts_owner_legacy_uidx
  on public.contacts(owner_id, legacy_id);
create unique index if not exists projects_owner_legacy_uidx
  on public.projects(owner_id, legacy_id);
create unique index if not exists calendar_events_owner_legacy_uidx
  on public.calendar_events(owner_id, legacy_id);
create unique index if not exists slr_templates_owner_legacy_uidx
  on public.slr_templates(owner_id, legacy_id);
create unique index if not exists project_documents_project_legacy_uidx
  on public.project_documents(project_id, legacy_id);
create unique index if not exists export_log_project_legacy_uidx
  on public.export_log(project_id, legacy_id);
create unique index if not exists contracts_project_uidx
  on public.contracts(project_id);
create unique index if not exists internal_notes_project_uidx
  on public.internal_notes(project_id);

create index if not exists projects_owner_customer_idx
  on public.projects(owner_id, customer_id);
create index if not exists project_documents_owner_storage_idx
  on public.project_documents(owner_id, storage_path);

-- Ownership helper functions are recreated to eliminate policy/function drift.
create or replace function public.owns_customer(target_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers
    where id = target_customer
      and owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects
    where id = target_project
      and owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_document(target_document uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_documents
    where id = target_document
      and owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_release(target_release uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.release_packages
    where id = target_release
      and owner_id = (select auth.uid())
  );
$$;

grant execute on function public.owns_customer(uuid) to authenticated;
grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.owns_document(uuid) to authenticated;
grant execute on function public.owns_release(uuid) to authenticated;

-- Reconcile policies affected by customer_id or cloud settings drift.
alter table if exists public.projects enable row level security;
drop policy if exists "projects_manage_own" on public.projects;
create policy "projects_manage_own"
on public.projects
for all
to authenticated
using (
  (select auth.uid()) = owner_id
  and (customer_id is null or public.owns_customer(customer_id))
)
with check (
  (select auth.uid()) = owner_id
  and (customer_id is null or public.owns_customer(customer_id))
);

alter table if exists public.user_settings enable row level security;
drop policy if exists "user_settings_manage_self" on public.user_settings;
create policy "user_settings_manage_self"
on public.user_settings
for all
to authenticated
using ((select auth.uid()) = owner_id and (select auth.uid()) = user_id)
with check ((select auth.uid()) = owner_id and (select auth.uid()) = user_id);

-- The production file bucket remains private.
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do update set public = false;

drop policy if exists "project_files_select_own" on storage.objects;
drop policy if exists "project_files_insert_own" on storage.objects;
drop policy if exists "project_files_update_own" on storage.objects;
drop policy if exists "project_files_delete_own" on storage.objects;

create policy "project_files_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_files_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_files_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_files_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A single RPC gives the browser a precise, non-destructive production health check.
create or replace function public.scopelogic_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing_items text[] := array[]::text[];
  required_item record;
  bucket_ready boolean := false;
begin
  for required_item in
    select * from (values
      ('customers', 'legacy_id'),
      ('contacts', 'customer_id'),
      ('projects', 'customer_id'),
      ('projects', 'legacy_id'),
      ('project_contacts', 'project_id'),
      ('project_systems', 'project_id'),
      ('slr_entries', 'legacy_uid'),
      ('slr_templates', 'template_data'),
      ('project_documents', 'storage_path'),
      ('project_documents', 'storage_migrated_at'),
      ('calendar_events', 'legacy_id'),
      ('contracts', 'project_id'),
      ('internal_notes', 'project_id'),
      ('export_log', 'legacy_id'),
      ('user_settings', 'selected_project_legacy_id'),
      ('user_settings', 'data_mode'),
      ('user_settings', 'cloud_revision'),
      ('user_settings', 'last_cloud_sync_at'),
      ('user_settings', 'cloud_cutover_completed_at'),
      ('import_runs', 'source_key')
    ) as required_columns(table_name, column_name)
  loop
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required_item.table_name
        and c.column_name = required_item.column_name
    ) then
      missing_items := array_append(missing_items, required_item.table_name || '.' || required_item.column_name);
    end if;
  end loop;

  select exists (
    select 1 from storage.buckets where id = 'project-files' and public = false
  ) into bucket_ready;

  if not bucket_ready then
    missing_items := array_append(missing_items, 'storage.project-files-private-bucket');
  end if;

  return jsonb_build_object(
    'version', 'RC3.1',
    'healthy', cardinality(missing_items) = 0,
    'missing', to_jsonb(missing_items),
    'bucketReady', bucket_ready,
    'checkedAt', timezone('utc', now())
  );
end;
$$;

grant execute on function public.scopelogic_schema_health() to authenticated;

-- Allow PostgREST to use the repaired tables while RLS remains the authorization boundary.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.customers, public.contacts, public.projects, public.project_contacts,
  public.project_systems, public.slr_entries, public.slr_templates, public.project_documents,
  public.calendar_events, public.contracts, public.internal_notes, public.release_packages,
  public.release_deliverables, public.export_log, public.activity_log, public.user_settings,
  public.import_runs
to authenticated;

-- Refresh the API schema after the transaction commits.
notify pgrst, 'reload schema';
