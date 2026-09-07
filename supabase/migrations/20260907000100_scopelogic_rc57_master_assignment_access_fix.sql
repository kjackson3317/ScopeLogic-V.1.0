drop policy if exists master_projects_workspace_access on public.master_projects;
create policy master_projects_workspace_access
on public.master_projects
for select
to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_master_project(master_projects.id))
);

drop policy if exists projects_workspace_access on public.projects;
create policy projects_workspace_access
on public.projects
for all
to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or assigned_user_id = (select auth.uid())
    or (master_project_id is not null and (select private.can_access_master_project(master_project_id)))
  )
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or assigned_user_id = (select auth.uid())
    or (master_project_id is not null and (select private.can_access_master_project(master_project_id)))
  )
);
