-- ScopeLogic v1.0 RC3 — live cloud data and private document storage cutover

alter table public.user_settings
  add column if not exists selected_project_legacy_id text,
  add column if not exists data_mode text not null default 'cloud' check (data_mode in ('cloud', 'local-fallback')),
  add column if not exists cloud_revision bigint not null default 0,
  add column if not exists last_cloud_sync_at timestamptz,
  add column if not exists cloud_cutover_completed_at timestamptz;

alter table public.project_documents
  add column if not exists storage_migrated_at timestamptz;

create index if not exists project_documents_owner_storage_idx
  on public.project_documents(owner_id, storage_path);

-- The bucket remains private. Existing manual creation is preserved.
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do update set public = false;

-- Ensure the authenticated role can call the ownership helper functions used by RLS.
grant execute on function public.owns_customer(uuid) to authenticated;
grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.owns_document(uuid) to authenticated;
grant execute on function public.owns_release(uuid) to authenticated;
