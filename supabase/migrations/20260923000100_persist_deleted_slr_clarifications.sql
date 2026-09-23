-- Persist intentional GC Clarification deletion back to the originating SLR.
--
-- A Review Note can create an SLR with include_clarification=true. The SLR
-- deliverable sync then creates a CL record. If that CL is later deleted, the
-- deletion is user intent and must survive later SLR/workspace saves.

alter table public.master_project_deliverable_items
  add column if not exists source_origin text not null default '';

create or replace function private.decouple_inserted_slr_clarification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.deliverable_type = 'CL'
     and new.source_child_uid = 'slr:clarification'
  then
    update public.master_project_deliverable_items
    set
      source_origin = 'slr:clarification',
      source_child_uid = ''
    where id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists master_project_deliverable_items_decouple_slr_cl_insert
  on public.master_project_deliverable_items;

create trigger master_project_deliverable_items_decouple_slr_cl_insert
after insert on public.master_project_deliverable_items
for each row
when (
  new.deliverable_type = 'CL'
  and new.source_child_uid = 'slr:clarification'
)
execute function private.decouple_inserted_slr_clarification();

create or replace function private.suppress_deleted_slr_clarification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Any GC Clarification deleted from an SLR is an intentional suppression.
  -- Persist that intent to both canonical SLR stores so a stale browser save
  -- or later deliverable synchronization cannot recreate the item.
  if old.deliverable_type = 'CL'
     and old.related_master_finding_id is not null
  then
    update public.slr_entries
    set
      include_clarification = false,
      updated_at = timezone('utc', now())
    where master_finding_id = old.related_master_finding_id
      and coalesce(include_clarification, false) = true;

    update public.master_project_findings
    set
      include_clarification = false,
      updated_at = timezone('utc', now())
    where id = old.related_master_finding_id
      and coalesce(include_clarification, false) = true;
  end if;

  return old;
end;
$function$;

drop trigger if exists master_project_deliverable_items_preserve_slr_cl_delete
  on public.master_project_deliverable_items;

create trigger master_project_deliverable_items_preserve_slr_cl_delete
after delete on public.master_project_deliverable_items
for each row
when (
  old.deliverable_type = 'CL'
  and old.related_master_finding_id is not null
)
execute function private.suppress_deleted_slr_clarification();

create or replace function private.remove_generated_clarification_when_excluded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.include_clarification is distinct from false
     and new.include_clarification = false
     and new.master_finding_id is not null
  then
    delete from public.master_project_deliverable_items
    where related_master_finding_id = new.master_finding_id
      and deliverable_type = 'CL'
      and (
        source_child_uid = 'slr:clarification'
        or source_origin = 'slr:clarification'
      );
  end if;

  return new;
end;
$function$;

drop trigger if exists slr_entries_remove_generated_clarification_when_excluded
  on public.slr_entries;

create trigger slr_entries_remove_generated_clarification_when_excluded
after update of include_clarification on public.slr_entries
for each row
when (
  old.include_clarification is distinct from new.include_clarification
  and new.include_clarification = false
)
execute function private.remove_generated_clarification_when_excluded();
