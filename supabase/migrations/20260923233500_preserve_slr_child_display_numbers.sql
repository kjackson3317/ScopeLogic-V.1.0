-- Keep customer-visible draft RFI/RBB display numbers aligned to the SLR child record
-- while allocating an independent collision-free internal sequence number.

create or replace function private.next_master_deliverable_type_sequence(
  p_master_project_id uuid,
  p_deliverable_type text,
  p_exclude_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate integer := 1;
begin
  loop
    exit when not exists (
      select 1
      from public.master_project_deliverable_items d
      where d.master_project_id = p_master_project_id
        and d.deliverable_type = p_deliverable_type
        and d.sequence_number = candidate
        and (p_exclude_id is null or d.id <> p_exclude_id)
    );
    candidate := candidate + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function private.guard_master_deliverable_number_collision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate integer;
  display_conflict boolean;
  sequence_conflict boolean;
begin
  if coalesce(new.display_number, '') like '__SLR_SYNC__%' then
    return new;
  end if;

  display_conflict := coalesce(new.display_number, '') = '' or exists (
    select 1
    from public.master_project_deliverable_items d
    where d.master_project_id = new.master_project_id
      and d.display_number = new.display_number
      and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  sequence_conflict := new.sequence_number is null or new.sequence_number < 1 or exists (
    select 1
    from public.master_project_deliverable_items d
    where d.master_project_id = new.master_project_id
      and d.deliverable_type = new.deliverable_type
      and d.sequence_number = new.sequence_number
      and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  if display_conflict then
    candidate := private.next_master_deliverable_sequence(new.master_project_id, new.deliverable_type, new.id);
    new.sequence_number := candidate;
    new.display_number := new.deliverable_type || '-' || lpad(candidate::text, 3, '0');
    new.sort_order := candidate;
  elsif sequence_conflict then
    candidate := private.next_master_deliverable_type_sequence(new.master_project_id, new.deliverable_type, new.id);
    new.sequence_number := candidate;
    new.sort_order := candidate;
  end if;

  return new;
end;
$$;
