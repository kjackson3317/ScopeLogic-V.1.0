-- Additive SLR parent/child storage. Existing flat fields remain for compatibility and rollback.
alter table public.slr_entries
  add column if not exists rfi_children jsonb not null default '[]'::jsonb,
  add column if not exists recommend_base_bid_children jsonb not null default '[]'::jsonb,
  add column if not exists contractor_checklist_children jsonb not null default '[]'::jsonb,
  add column if not exists number_locked boolean not null default false,
  add column if not exists number_released_at timestamptz;

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

notify pgrst, 'reload schema';
