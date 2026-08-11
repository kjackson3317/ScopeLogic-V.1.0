-- ScopeLogic v1.0 RC5.5.2
-- Full-workspace restore points with user-scoped access and bounded retention.

create table if not exists public.workspace_backups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  backup_kind text not null default 'automatic'
    check (backup_kind in ('automatic', 'manual', 'browser-recovery', 'pre-restore')),
  reason text not null default 'Automatic workspace checkpoint',
  cloud_revision bigint not null default 0,
  project_count integer not null default 0,
  part_count integer not null default 0,
  quote_count integer not null default 0,
  workspace_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_backups_owner_created_idx
  on public.workspace_backups(owner_id, created_at desc);

alter table public.workspace_backups enable row level security;

grant select, insert, delete on table public.workspace_backups to authenticated;

drop policy if exists "workspace_backups_select_self" on public.workspace_backups;
create policy "workspace_backups_select_self"
  on public.workspace_backups for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "workspace_backups_insert_self" on public.workspace_backups;
create policy "workspace_backups_insert_self"
  on public.workspace_backups for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "workspace_backups_delete_self" on public.workspace_backups;
create policy "workspace_backups_delete_self"
  on public.workspace_backups for delete to authenticated
  using (owner_id = auth.uid());

comment on table public.workspace_backups is
  'Bounded full-workspace restore points used by ScopeLogic RC5.5.2 data protection.';

notify pgrst, 'reload schema';
