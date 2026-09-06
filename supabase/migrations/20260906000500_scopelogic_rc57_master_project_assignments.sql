-- RC5.7 Master Project assignment model.
-- The Project Library is driven by Master Project assignment, not individual Client Engagement assignment.

create table if not exists public.master_project_assignments (
  master_project_id uuid not null references public.master_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (master_project_id, user_id)
);

create index if not exists master_project_assignments_user_idx
  on public.master_project_assignments(user_id);

insert into public.master_project_assignments(master_project_id, user_id, assigned_by_user_id)
select mp.id, mp.created_by_user_id, mp.created_by_user_id
from public.master_projects mp
on conflict do nothing;

insert into public.master_project_assignments(master_project_id, user_id, assigned_by_user_id)
select distinct p.master_project_id, p.assigned_user_id, coalesce(mp.created_by_user_id, p.assigned_user_id)
from public.projects p
join public.master_projects mp on mp.id = p.master_project_id
where p.master_project_id is not null
on conflict do nothing;

alter table public.master_project_assignments enable row level security;

drop policy if exists master_project_assignments_read on public.master_project_assignments;
create policy master_project_assignments_read
on public.master_project_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_is_workspace_admin())
);

drop policy if exists master_project_assignments_manage on public.master_project_assignments;
create policy master_project_assignments_manage
on public.master_project_assignments
for all
to authenticated
using ((select private.current_is_workspace_admin()))
with check (
  (select private.current_is_workspace_admin())
  and exists (
    select 1 from public.profiles p
    where p.id = master_project_assignments.user_id
      and p.workspace_owner_id = (select private.current_workspace_owner())
  )
);

grant select, insert, update, delete on public.master_project_assignments to authenticated;

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
        or exists (
          select 1
          from public.master_project_assignments a
          where a.master_project_id = mp.id
            and a.user_id = (select auth.uid())
        )
      )
  );
$$;

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
      and p.master_project_id is not null
      and (select private.can_access_master_project(p.master_project_id))
  );
$$;

create or replace function public.ensure_master_assignment_for_engagement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.master_project_id is not null and new.assigned_user_id is not null then
    insert into public.master_project_assignments(master_project_id, user_id, assigned_by_user_id)
    values (new.master_project_id, new.assigned_user_id, coalesce((select auth.uid()), new.assigned_user_id))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_ensure_master_assignment on public.projects;
create trigger projects_ensure_master_assignment
after insert or update of master_project_id, assigned_user_id on public.projects
for each row execute function public.ensure_master_assignment_for_engagement();

comment on table public.master_project_assignments is
  'Controls which Master Projects appear in each user Project Library. Client Engagements never appear as separate Project Library rows.';

notify pgrst, 'reload schema';
