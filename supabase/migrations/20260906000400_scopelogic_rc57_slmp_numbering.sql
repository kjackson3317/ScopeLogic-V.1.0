-- RC5.7 Master Project numbering standard
-- Format: SLMP-YY### (example: SLMP-26001)
-- Sequence resets each calendar year within the ScopeLogic workspace owner.
-- Numbers are permanent identifiers: deleting a Master Project never renumbers
-- existing projects and never makes a deleted number available for reuse.

create table if not exists public.master_project_number_counters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_year integer not null,
  last_number integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_id, project_year),
  constraint master_project_number_counters_range check (last_number between 0 and 999)
);

-- One-time conversion of the current RC5.7 preview/test Master Projects to the
-- final SLMP-YY### standard. After this migration, project numbers are never
-- recalculated from row order and are not affected by archive/delete actions.
with numbered as (
  select
    id,
    owner_id,
    created_at,
    extract(year from created_at at time zone 'UTC')::integer as project_year,
    right(extract(year from created_at at time zone 'UTC')::integer::text, 2) as yy,
    row_number() over (
      partition by owner_id, extract(year from created_at at time zone 'UTC')
      order by created_at, id
    ) as seq
  from public.master_projects
), renumbered as (
  update public.master_projects mp
  set project_number = 'SLMP-' || n.yy || lpad(n.seq::text, 3, '0')
  from numbered n
  where mp.id = n.id
  returning mp.owner_id, n.project_year, n.seq
)
insert into public.master_project_number_counters (owner_id, project_year, last_number)
select owner_id, project_year, max(seq)::integer
from renumbered
group by owner_id, project_year
on conflict (owner_id, project_year) do update
set last_number = greatest(public.master_project_number_counters.last_number, excluded.last_number),
    updated_at = timezone('utc', now());

create or replace function public.assign_master_project_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_year integer;
  yy text;
  next_seq integer;
begin
  if nullif(btrim(new.project_number), '') is null then
    project_year := extract(year from coalesce(new.created_at, timezone('utc', now())))::integer;
    yy := right(project_year::text, 2);

    insert into public.master_project_number_counters (owner_id, project_year, last_number)
    values (new.owner_id, project_year, 1)
    on conflict (owner_id, project_year) do update
      set last_number = public.master_project_number_counters.last_number + 1,
          updated_at = timezone('utc', now())
    returning last_number into next_seq;

    if next_seq > 999 then
      raise exception 'ScopeLogic Master Project numbering exceeded 999 projects for year %', project_year;
    end if;

    new.project_number := 'SLMP-' || yy || lpad(next_seq::text, 3, '0');
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

comment on column public.master_projects.project_number is
  'Permanent auto-generated ScopeLogic Master Project identifier in SLMP-YY### format; e.g. SLMP-26001. Never reused after delete.';
comment on table public.master_project_number_counters is
  'Persistent yearly counters for ScopeLogic Master Project identifiers. Counters are not decremented when projects are archived or deleted.';

notify pgrst, 'reload schema';
