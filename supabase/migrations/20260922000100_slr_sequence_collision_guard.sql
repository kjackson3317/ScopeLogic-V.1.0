-- Prevent stale Review Notes / client state from reusing an existing SLR
-- sequence number. Existing SLR identities continue through the normal
-- (project_id, legacy_uid) upsert path without being renumbered.

create or replace function private.allocate_slr_sequence_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_master_project_id uuid;
  v_next_sequence integer;
  v_project_max integer;
  v_master_max integer;
  v_collision boolean;
begin
  select p.master_project_id
    into v_master_project_id
  from public.projects p
  where p.id = new.project_id;

  -- Serialize new-number allocation by Master Project when available so
  -- concurrent creates cannot choose the same next sequence.
  perform pg_advisory_xact_lock(
    hashtext(coalesce(v_master_project_id::text, new.project_id::text))::bigint
  );

  -- Existing identities are handled by the canonical upsert path. Do not
  -- renumber them before ON CONFLICT (project_id, legacy_uid) is evaluated.
  if exists (
    select 1
    from public.slr_entries e
    where e.project_id = new.project_id
      and e.legacy_uid = new.legacy_uid
  ) then
    return new;
  end if;

  v_collision :=
    new.sequence_number is null
    or new.sequence_number <= 0
    or exists (
      select 1
      from public.slr_entries e
      where e.project_id = new.project_id
        and e.sequence_number = new.sequence_number
    )
    or (
      v_master_project_id is not null
      and exists (
        select 1
        from public.master_project_findings f
        where f.master_project_id = v_master_project_id
          and f.sequence_number = new.sequence_number
      )
    );

  if v_collision then
    select coalesce(max(e.sequence_number), 0)
      into v_project_max
    from public.slr_entries e
    where e.project_id = new.project_id;

    if v_master_project_id is not null then
      select coalesce(max(f.sequence_number), 0)
        into v_master_max
      from public.master_project_findings f
      where f.master_project_id = v_master_project_id;
    else
      v_master_max := 0;
    end if;

    v_next_sequence := greatest(v_project_max, v_master_max) + 1;
    new.sequence_number := v_next_sequence;
    new.display_number := 'SLR-' || case
      when v_next_sequence < 1000 then lpad(v_next_sequence::text, 3, '0')
      else v_next_sequence::text
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists slr_entries_allocate_sequence on public.slr_entries;

create trigger slr_entries_allocate_sequence
before insert on public.slr_entries
for each row
execute function private.allocate_slr_sequence_on_insert();
