-- RC5.7 Master Project numbering standard
-- Format: SLMP-YY### (example: SLMP-26001)
-- Sequence resets each calendar year within the ScopeLogic workspace owner.

-- Renumber existing Master Projects deterministically by workspace and creation year.
with numbered as (
  select
    id,
    owner_id,
    created_at,
    to_char(created_at at time zone 'UTC', 'YY') as yy,
    row_number() over (
      partition by owner_id, extract(year from created_at at time zone 'UTC')
      order by created_at, id
    ) as seq
  from public.master_projects
)
update public.master_projects mp
set project_number = 'SLMP-' || n.yy || lpad(n.seq::text, 3, '0')
from numbered n
where mp.id = n.id;

create or replace function public.assign_master_project_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yy text;
  next_seq integer;
  project_year integer;
begin
  -- Project number is system-generated whenever one is not explicitly supplied.
  if nullif(btrim(new.project_number), '') is null then
    project_year := extract(year from coalesce(new.created_at, timezone('utc', now())))::integer;
    yy := right(project_year::text, 2);

    -- Prevent two concurrent inserts in the same workspace/year from receiving
    -- the same sequence number.
    perform pg_advisory_xact_lock(
      hashtext(new.owner_id::text),
      project_year
    );

    select coalesce(max(right(mp.project_number, 3)::integer), 0) + 1
      into next_seq
    from public.master_projects mp
    where mp.owner_id = new.owner_id
      and mp.project_number ~ ('^SLMP-' || yy || '[0-9]{3}$');

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

comment on column public.master_projects.project_number is
  'Auto-generated ScopeLogic Master Project identifier in SLMP-YY### format; e.g. SLMP-26001.';

notify pgrst, 'reload schema';
