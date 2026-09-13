-- Additive SLR parent/child storage. Existing flat fields remain for compatibility and rollback.
alter table public.slr_entries
  add column if not exists rfi_children jsonb not null default '[]'::jsonb,
  add column if not exists recommend_base_bid_children jsonb not null default '[]'::jsonb,
  add column if not exists contractor_checklist_children jsonb not null default '[]'::jsonb,
  add column if not exists number_locked boolean not null default false,
  add column if not exists number_released_at timestamptz,
  add column if not exists rbb_scope_letter_map jsonb not null default '{}'::jsonb;

create index if not exists slr_entries_rfi_children_gin_idx on public.slr_entries using gin (rfi_children);
create index if not exists slr_entries_rbb_children_gin_idx on public.slr_entries using gin (recommend_base_bid_children);

-- Preserve customer-visible SLR numbers when an archived Official Release contains the same SLR.
update public.slr_entries entry
set number_locked = true,
    number_released_at = coalesce(entry.number_released_at, history.first_released_at)
from (
  select e.id, min(rp.released_at) first_released_at
  from public.slr_entries e
  join public.release_packages rp on rp.project_id = e.project_id
  where jsonb_typeof(coalesce(rp.snapshot_data -> 'issues', '[]'::jsonb)) = 'array'
    and exists (
      select 1 from jsonb_array_elements(coalesce(rp.snapshot_data -> 'issues', '[]'::jsonb)) snapshot_issue
      where coalesce(snapshot_issue ->> 'uid', '') = coalesce(e.legacy_uid, '')
         or coalesce(snapshot_issue ->> 'id', '') = e.display_number
    )
  group by e.id
) history
where entry.id = history.id;

-- Convert legacy customer-visible RFI numbers into locked child records so an
-- upgrade can never silently renumber a previously issued RFI.
with legacy_rfi_visibility as (
  select e.id, min(rp.released_at) as first_released_at
  from public.slr_entries e
  join public.release_packages rp on rp.project_id = e.project_id
  where coalesce(e.rfi_number, '') <> ''
    and coalesce(e.rfi_question, '') <> ''
    and (
      coalesce(rp.snapshot_data -> 'deliverables', '[]'::jsonb) ? 'rfi'
      or coalesce(rp.snapshot_data -> 'deliverables', '[]'::jsonb) ? 'clarifications'
    )
    and exists (
      select 1 from jsonb_array_elements(coalesce(rp.snapshot_data -> 'issues', '[]'::jsonb)) snapshot_issue
      where coalesce(snapshot_issue ->> 'uid', '') = coalesce(e.legacy_uid, '')
         or coalesce(snapshot_issue ->> 'id', '') = e.display_number
    )
  group by e.id
), legacy_rfi_payload as (
  select e.id, visibility.first_released_at
  from public.slr_entries e
  left join legacy_rfi_visibility visibility on visibility.id = e.id
  where coalesce(e.rfi_number, '') <> ''
    and coalesce(e.rfi_question, '') <> ''
    and (e.rfi_children is null or e.rfi_children = '[]'::jsonb)
)
update public.slr_entries entry
set rfi_children = jsonb_build_array(jsonb_build_object(
  'uid', gen_random_uuid()::text,
  'number', entry.rfi_number,
  'title', entry.scope_item,
  'systems', case when jsonb_typeof(entry.systems) = 'array' and jsonb_array_length(entry.systems) > 0 then entry.systems else jsonb_build_array(coalesce(nullif(entry.system_name, ''), 'Structured Cabling')) end,
  'question', entry.rfi_question,
  'reference', entry.reference,
  'status', case when coalesce(entry.resolution, '') <> '' then 'Answered' when payload.first_released_at is not null then 'Issued' else 'Draft' end,
  'response', entry.resolution,
  'responseDate', '',
  'responseSource', '',
  'includeInFormalRfi', entry.include_formal_rfi,
  'locked', payload.first_released_at is not null,
  'releasedAt', coalesce(payload.first_released_at::text, ''),
  'relatedChildNumbers', '[]'::jsonb
))
from legacy_rfi_payload payload
where entry.id = payload.id;

notify pgrst, 'reload schema';
