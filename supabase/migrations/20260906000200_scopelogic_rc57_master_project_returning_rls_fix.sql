-- RC5.7 Master Project insert/RETURNING RLS fix.
-- INSERT itself was permitted, but PostgREST .insert(...).select(...) also evaluates
-- the SELECT policy. Avoid querying master_projects recursively for the common
-- creator/admin path so a newly inserted row can be returned immediately.

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
      from public.projects p
      where p.master_project_id = master_projects.id
        and p.assigned_user_id = (select auth.uid())
    )
  )
);

-- Correct the engagement-existence test in the delete policy as well.
drop policy if exists master_projects_workspace_delete on public.master_projects;
create policy master_projects_workspace_delete
on public.master_projects
for delete
to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (
    (select private.current_is_workspace_admin())
    or created_by_user_id = (select auth.uid())
  )
  and not exists (
    select 1 from public.projects p
    where p.master_project_id = master_projects.id
  )
);

notify pgrst, 'reload schema';
