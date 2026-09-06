-- RC5.7 Master Project auto-numbering and archive support.

create sequence if not exists public.master_project_number_seq;

do $$
declare max_num bigint := 0;
begin
  select coalesce(max((regexp_match(project_number, '^MPT-([0-9]+)$'))[1]::bigint), 0)
    into max_num
  from public.master_projects
  where project_number ~ '^MPT-[0-9]+$';

  if max_num > 0 then
    perform setval('public.master_project_number_seq', max_num, true);
  else
    perform setval('public.master_project_number_seq', 1, false);
  end if;
end $$;

with ranked as (
  select id, project_number,
         row_number() over (partition by project_number order by created_at, id) as rn
  from public.master_projects
), needs_number as (
  select id from ranked
  where coalesce(project_number, '') = ''
     or (project_number <> '' and rn > 1)
)
update public.master_projects mp
set project_number = 'MPT-' || lpad(nextval('public.master_project_number_seq')::text, 3, '0')
from needs_number n
where mp.id = n.id;

do $$
declare max_num bigint := 0;
begin
  select coalesce(max((regexp_match(project_number, '^MPT-([0-9]+)$'))[1]::bigint), 0)
    into max_num
  from public.master_projects
  where project_number ~ '^MPT-[0-9]+$';
  perform setval('public.master_project_number_seq', greatest(max_num, 1), true);
end $$;

create or replace function public.assign_master_project_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(new.project_number), '') is null then
    new.project_number := 'MPT-' || lpad(nextval('public.master_project_number_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists master_projects_assign_number on public.master_projects;
create trigger master_projects_assign_number
before insert on public.master_projects
for each row execute function public.assign_master_project_number();

create unique index if not exists master_projects_owner_project_number_uidx
  on public.master_projects(owner_id, project_number);

alter table public.master_projects
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

notify pgrst, 'reload schema';
