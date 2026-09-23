-- Treat Review Note / SLR-generated GC Clarifications as normal editable
-- clarification records after the initial creation.
--
-- Previously the SLR sync function continued to own the generated CL row and
-- rewrote its title/content/reference on later SLR saves. That made edits made
-- in the SLR-owned GC Clarification editor appear to revert. Preserve the
-- origin for deletion semantics, but clear source_child_uid so later SLR syncs
-- recognize the row as an existing clarification and leave it alone.

alter table public.master_project_deliverable_items
  add column if not exists source_origin text not null default '';

update public.master_project_deliverable_items
set
  source_origin = 'slr:clarification',
  source_child_uid = ''
where deliverable_type = 'CL'
  and source_child_uid = 'slr:clarification';

create or replace function private.decouple_inserted_slr_clarification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

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
as $$
begin
  if old.deliverable_type = 'CL'
     and (
       old.source_child_uid = 'slr:clarification'
       or old.source_origin = 'slr:clarification'
     )
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
$$;

drop trigger if exists master_project_deliverable_items_preserve_slr_cl_delete
  on public.master_project_deliverable_items;

create trigger master_project_deliverable_items_preserve_slr_cl_delete
after delete on public.master_project_deliverable_items
for each row
when (
  old.deliverable_type = 'CL'
  and (
    old.source_child_uid = 'slr:clarification'
    or old.source_origin = 'slr:clarification'
  )
)
execute function private.suppress_deleted_slr_clarification();

create or replace function private.remove_generated_clarification_when_excluded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.include_clarification is distinct from false
     and new.include_clarification = false
     and new.master_finding_id is not null
  then
    delete from public.master_project_deliverable_items
    where related_master_finding_id = new.master_finding_id
      and deliverable_type = 'CL'
      and source_origin = 'slr:clarification';
  end if;
  return new;
end;
$$;

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
