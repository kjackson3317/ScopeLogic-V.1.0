-- SLR child lifecycle correction.
--
-- SLR / Master Finding is the canonical parent for generated and SLR-owned
-- deliverable records. The original Review Deliverables schema used
-- ON DELETE SET NULL for those relationships, which converted RFI/RBB/CL/VE
-- and checklist children into live orphan records when an SLR was deleted.
--
-- Keep Review Notes independent (their finding link intentionally remains
-- ON DELETE SET NULL), but make actual SLR child deliverables follow the
-- parent lifecycle.

-- Remove only existing rows whose provenance proves they came from an SLR.
-- Standalone/manual deliverables with no SLR provenance are intentionally kept.
delete from public.master_project_deliverable_items d
where d.related_master_finding_id is null
  and (
    d.source_child_uid like 'rfi:%'
    or d.source_child_uid like 'rbb:%'
    or d.source_child_uid = 'slr:clarification'
    or d.source_origin = 'slr:clarification'
    or d.source_origin like 'slr:draft:%'
  );

delete from public.master_project_checklist_items c
where c.linked_master_finding_id is null
  and c.source_child_uid like 'checklist:%';

-- A direct GC Clarification deletion must still suppress regeneration while
-- its SLR exists. A clarification removed because its parent SLR is cascading
-- away must not try to mutate the deleting parent.
create or replace function private.suppress_deleted_slr_clarification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deliverable_type <> 'CL'
     or old.related_master_finding_id is null
     or not exists (
       select 1
       from public.master_project_findings f
       where f.id = old.related_master_finding_id
     )
  then
    return old;
  end if;

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

  return old;
end;
$$;

-- Deliverables and contractor checklist records are children of the Master
-- Finding. Deleting the parent must delete these rows instead of nulling the
-- relationship and leaving them visible in Review Deliverables.
alter table public.master_project_deliverable_items
  drop constraint if exists master_project_deliverable_items_related_master_finding_id_fkey;

alter table public.master_project_deliverable_items
  add constraint master_project_deliverable_items_related_master_finding_id_fkey
  foreign key (related_master_finding_id)
  references public.master_project_findings(id)
  on delete cascade;

alter table public.master_project_checklist_items
  drop constraint if exists master_project_checklist_items_linked_master_finding_id_fkey;

alter table public.master_project_checklist_items
  add constraint master_project_checklist_items_linked_master_finding_id_fkey
  foreign key (linked_master_finding_id)
  references public.master_project_findings(id)
  on delete cascade;
