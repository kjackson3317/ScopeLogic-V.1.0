-- SLC hotfix: restore Master Project insert/RETURNING access after the
-- assignment-access migration reintroduced the recursive SELECT policy.
--
-- Copy Master Project creates a new master row and immediately requests the
-- generated id/project number with PostgREST .insert(...).select(...). The
-- creator/admin must be able to read that new row before assignment rows or
-- child Client Engagements exist.

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
          select 1
          from public.master_project_assignments a
          where a.master_project_id = mp.id
            and a.user_id = (select auth.uid())
        )
      )
  );
$$;

-- Keep the SELECT policy non-recursive for the creator/admin path so an
-- INSERT ... RETURNING/SELECT can see a just-created row. Assigned users keep
-- access through master_project_assignments.
drop policy if exists master_projects_workspace_access on public.master_projects;
create policy master_projects_workspace_access
on public.master_projects
for select
to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
    or exists (
      select 1
      from public.master_project_assignments a
      where a.master_project_id = master_projects.id
        and a.user_id = (select auth.uid())
    )
  )
);

notify pgrst, 'reload schema';
