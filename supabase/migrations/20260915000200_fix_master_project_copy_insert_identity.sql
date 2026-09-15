-- SLC hotfix: make Master Project copy inserts derive workspace/creator identity
-- directly from the authenticated session before RLS evaluates the row.
-- This prevents stale or transformed client identity values from causing a
-- false RLS rejection during Copy Master Project.

create or replace function private.enforce_master_project_insert_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.owner_id := (select private.current_workspace_owner());
    new.created_by_user_id := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_master_project_insert_identity on public.master_projects;
create trigger enforce_master_project_insert_identity
before insert on public.master_projects
for each row execute function private.enforce_master_project_insert_identity();

revoke all on function private.enforce_master_project_insert_identity() from public, anon;

notify pgrst, 'reload schema';
