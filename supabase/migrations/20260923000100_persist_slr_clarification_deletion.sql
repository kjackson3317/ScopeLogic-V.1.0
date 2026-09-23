-- Preserve a user's explicit deletion of an SLR-generated GC Clarification.
--
-- Review Note -> Create SLR can set include_clarification=true. The existing
-- SLR deliverable sync function correctly regenerates the CL while that flag
-- remains true. Previously, deleting the generated CL row did not clear that
-- source flag, so the next SLR save/sync recreated the deleted clarification.
--
-- When the deleted row is specifically the SLR-managed clarification
-- (source_child_uid = 'slr:clarification'), clear the source flag on both the
-- canonical SLR entry and its Master Finding. Manual CL rows are untouched.

create or replace function private.suppress_deleted_slr_clarification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deliverable_type = 'CL'
     and old.source_child_uid = 'slr:clarification'
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
  and old.source_child_uid = 'slr:clarification'
)
execute function private.suppress_deleted_slr_clarification();
