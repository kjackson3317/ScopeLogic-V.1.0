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

-- Historical release matching is deliberately conservative. A customer-visible record
-- is locked when the archived release snapshot contains the SLR and the release package
-- contains the relevant deliverable. Blank legacy identifiers never count as a match.
with slr_release_visibility as (
  select e.id, min(rp.released_at) as first_released_at
  from public.slr_entries e
  join public.release_packages rp on rp.project_id = e.project_id
  where (
      exists (
        select 1
        from public.release_deliverables rd
        where rd.release_package_id = rp.id
          and rd.deliverable_type in ('sow', 'clarifications', 'checklist')
      )
      or (
        jsonb_typeof(rp.snapshot_data -> 'deliverables') = 'array'
        and (
          (rp.snapshot_data -> 'deliverables') ? 'sow'
          or (rp.snapshot_data -> 'deliverables') ? 'clarifications'
          or (rp.snapshot_data -> 'deliverables') ? 'checklist'
        )
      )
    )
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(rp.snapshot_data -> 'issues') = 'array' then rp.snapshot_data -> 'issues'
          else '[]'::jsonb
        end
      ) snapshot_issue
      where (
          nullif(snapshot_issue ->> 'uid', '') is not null
          and snapshot_issue ->> 'uid' = e.legacy_uid
        )
        or (
          nullif(snapshot_issue ->> 'id', '') is not null
          and snapshot_issue ->> 'id' = e.display_number
        )
    )
  group by e.id
)
update public.slr_entries entry
set number_locked = true,
    number_released_at = coalesce(entry.number_released_at, visibility.first_released_at)
from slr_release_visibility visibility
where entry.id = visibility.id;

-- Convert legacy RFIs into nested child records. If an archived Formal RFI or
-- Clarification Log contains the parent SLR, preserve the historical RFI as locked.
with legacy_rfi_visibility as (
  select e.id, min(rp.released_at) as first_released_at
  from public.slr_entries e
  join public.release_packages rp on rp.project_id = e.project_id
  where coalesce(e.rfi_number, '') <> ''
    and coalesce(e.rfi_question, '') <> ''
    and (
      exists (
        select 1
        from public.release_deliverables rd
        where rd.release_package_id = rp.id
          and rd.deliverable_type in ('rfi', 'clarifications')
      )
      or (
        jsonb_typeof(rp.snapshot_data -> 'deliverables') = 'array'
        and (
          (rp.snapshot_data -> 'deliverables') ? 'rfi'
          or (rp.snapshot_data -> 'deliverables') ? 'clarifications'
        )
      )
    )
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(rp.snapshot_data -> 'issues') = 'array' then rp.snapshot_data -> 'issues'
          else '[]'::jsonb
        end
      ) snapshot_issue
      where (
          nullif(snapshot_issue ->> 'uid', '') is not null
          and snapshot_issue ->> 'uid' = e.legacy_uid
        )
        or (
          nullif(snapshot_issue ->> 'id', '') is not null
          and snapshot_issue ->> 'id' = e.display_number
        )
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
  'systems', case
    when jsonb_typeof(entry.systems) = 'array' and jsonb_array_length(entry.systems) > 0 then entry.systems
    else jsonb_build_array(coalesce(nullif(entry.system_name, ''), 'Structured Cabling'))
  end,
  'question', entry.rfi_question,
  'reference', entry.reference,
  'status', case
    when coalesce(entry.resolution, '') <> '' then 'Answered'
    when payload.first_released_at is not null then 'Issued'
    else 'Draft'
  end,
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

-- Convert legacy Recommended Base Bid text into nested RBB sections. Previously
-- released SOW/Clarification content is frozen even though older PDFs did not print
-- the new RBB identifier.
with legacy_rbb_visibility as (
  select e.id, min(rp.released_at) as first_released_at
  from public.slr_entries e
  join public.release_packages rp on rp.project_id = e.project_id
  where (
      exists (
        select 1
        from public.release_deliverables rd
        where rd.release_package_id = rp.id
          and rd.deliverable_type in ('sow', 'clarifications')
      )
      or (
        jsonb_typeof(rp.snapshot_data -> 'deliverables') = 'array'
        and (
          (rp.snapshot_data -> 'deliverables') ? 'sow'
          or (rp.snapshot_data -> 'deliverables') ? 'clarifications'
        )
      )
    )
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(rp.snapshot_data -> 'issues') = 'array' then rp.snapshot_data -> 'issues'
          else '[]'::jsonb
        end
      ) snapshot_issue
      where (
          nullif(snapshot_issue ->> 'uid', '') is not null
          and snapshot_issue ->> 'uid' = e.legacy_uid
        )
        or (
          nullif(snapshot_issue ->> 'id', '') is not null
          and snapshot_issue ->> 'id' = e.display_number
        )
    )
  group by e.id
), legacy_rbb_payload as (
  select
    e.id,
    visibility.first_released_at,
    case
      when jsonb_typeof(e.recommended_bid_basis_by_system) = 'object'
        and exists (
          select 1 from jsonb_each_text(e.recommended_bid_basis_by_system) basis
          where btrim(basis.value) <> ''
        )
      then e.recommended_bid_basis_by_system
      when btrim(coalesce(e.recommended_bid_basis, '')) <> ''
      then jsonb_build_object(coalesce(nullif(e.system_name, ''), 'Structured Cabling'), e.recommended_bid_basis)
      else '{}'::jsonb
    end as recommendations
  from public.slr_entries e
  left join legacy_rbb_visibility visibility on visibility.id = e.id
  where e.recommend_base_bid_children is null
     or e.recommend_base_bid_children = '[]'::jsonb
)
update public.slr_entries entry
set recommend_base_bid_children = jsonb_build_array(jsonb_build_object(
  'uid', gen_random_uuid()::text,
  'baseSequence', 0,
  'baseNumber', '',
  'title', entry.scope_item,
  'selectedSystems', (
    select coalesce(jsonb_agg(basis.key order by basis.key), '[]'::jsonb)
    from jsonb_each_text(payload.recommendations) basis
    where btrim(basis.value) <> ''
  ),
  'forceSuffix', (
    select count(*) > 1
    from jsonb_each_text(payload.recommendations) basis
    where btrim(basis.value) <> ''
  ),
  'sections', (
    select coalesce(jsonb_object_agg(
      basis.key,
      jsonb_build_object(
        'uid', gen_random_uuid()::text,
        'system', basis.key,
        'suffix', '',
        'displayNumber', '',
        'recommendation', basis.value,
        'status', 'Current',
        'locked', payload.first_released_at is not null,
        'contentReleased', payload.first_released_at is not null,
        'releasedAt', coalesce(payload.first_released_at::text, ''),
        'supersedesNumber', '',
        'basedOnRfiUids', '[]'::jsonb
      )
    ), '{}'::jsonb)
    from jsonb_each_text(payload.recommendations) basis
    where btrim(basis.value) <> ''
  )
))
from legacy_rbb_payload payload
where entry.id = payload.id
  and exists (
    select 1 from jsonb_each_text(payload.recommendations) basis
    where btrim(basis.value) <> ''
  );

-- Convert legacy checklist scope into child questions. Questions that appeared in an
-- archived Contractor Response Checklist are immutable; responses remain editable.
with legacy_checklist_visibility as (
  select e.id, min(rp.released_at) as first_released_at
  from public.slr_entries e
  join public.release_packages rp on rp.project_id = e.project_id
  where (
      exists (
        select 1
        from public.release_deliverables rd
        where rd.release_package_id = rp.id
          and rd.deliverable_type = 'checklist'
      )
      or (
        jsonb_typeof(rp.snapshot_data -> 'deliverables') = 'array'
        and (rp.snapshot_data -> 'deliverables') ? 'checklist'
      )
    )
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(rp.snapshot_data -> 'issues') = 'array' then rp.snapshot_data -> 'issues'
          else '[]'::jsonb
        end
      ) snapshot_issue
      where (
          nullif(snapshot_issue ->> 'uid', '') is not null
          and snapshot_issue ->> 'uid' = e.legacy_uid
        )
        or (
          nullif(snapshot_issue ->> 'id', '') is not null
          and snapshot_issue ->> 'id' = e.display_number
        )
    )
  group by e.id
), legacy_checklist_payload as (
  select
    e.id,
    visibility.first_released_at,
    case
      when jsonb_typeof(e.checklist_scope_items_by_system) = 'object'
        and exists (
          select 1 from jsonb_each_text(e.checklist_scope_items_by_system) checklist
          where btrim(checklist.value) <> ''
        )
      then e.checklist_scope_items_by_system
      when btrim(coalesce(e.checklist_scope_item, '')) <> ''
      then jsonb_build_object(coalesce(nullif(e.system_name, ''), 'Structured Cabling'), e.checklist_scope_item)
      else '{}'::jsonb
    end as checklist_items
  from public.slr_entries e
  left join legacy_checklist_visibility visibility on visibility.id = e.id
  where e.contractor_checklist_children is null
     or e.contractor_checklist_children = '[]'::jsonb
)
update public.slr_entries entry
set contractor_checklist_children = (
  select coalesce(jsonb_agg(jsonb_build_object(
    'uid', gen_random_uuid()::text,
    'number', '',
    'system', checklist.key,
    'question', checklist.value,
    'status', 'Open',
    'response', coalesce(nullif(entry.contractor_response, ''), 'Included'),
    'responseReason', coalesce(entry.contractor_response_reason, ''),
    'locked', payload.first_released_at is not null,
    'releasedAt', coalesce(payload.first_released_at::text, ''),
    'verifiesRbbNumbers', '[]'::jsonb
  ) order by checklist.key), '[]'::jsonb)
  from jsonb_each_text(payload.checklist_items) checklist
  where btrim(checklist.value) <> ''
)
from legacy_checklist_payload payload
where entry.id = payload.id
  and exists (
    select 1 from jsonb_each_text(payload.checklist_items) checklist
    where btrim(checklist.value) <> ''
  );

-- Extend the existing RC5.5 health contract without changing its version token, because
-- the browser intentionally requires that exact version string before cloud writes.
create or replace function public.scopelogic_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing_items text[] := array[]::text[];
  required_item record;
  bucket_ready boolean := false;
begin
  for required_item in
    select * from (values
      ('customers', 'legacy_id'),
      ('contacts', 'customer_id'),
      ('projects', 'customer_id'),
      ('projects', 'legacy_id'),
      ('project_contacts', 'project_id'),
      ('project_systems', 'project_id'),
      ('slr_entries', 'legacy_uid'),
      ('slr_entries', 'systems'),
      ('slr_entries', 'recommended_bid_basis_by_system'),
      ('slr_entries', 'checklist_scope_items_by_system'),
      ('slr_entries', 'ai_assistance'),
      ('slr_entries', 'source_type'),
      ('slr_entries', 'rfi_children'),
      ('slr_entries', 'recommend_base_bid_children'),
      ('slr_entries', 'contractor_checklist_children'),
      ('slr_entries', 'number_locked'),
      ('slr_entries', 'number_released_at'),
      ('slr_entries', 'rbb_scope_letter_map'),
      ('slr_templates', 'template_data'),
      ('project_documents', 'storage_path'),
      ('project_documents', 'storage_migrated_at'),
      ('calendar_events', 'legacy_id'),
      ('contracts', 'project_id'),
      ('contracts', 'primary_contact_legacy_id'),
      ('contracts', 'agreement_number'),
      ('contracts', 'purchase_order_number'),
      ('contracts', 'contract_date'),
      ('contracts', 'notice_to_proceed_date'),
      ('contracts', 'original_contract_amount'),
      ('contracts', 'approved_additional_services'),
      ('contracts', 'amount_invoiced'),
      ('contracts', 'amount_paid'),
      ('contracts', 'billing_method'),
      ('contracts', 'billing_notes'),
      ('contracts', 'contracted_service'),
      ('contracts', 'included_deliverables'),
      ('contracts', 'included_review_cycles'),
      ('contracts', 'project_phase'),
      ('contracts', 'anticipated_completion_date'),
      ('contracts', 'next_client_action'),
      ('contracts', 'agreement_uploaded'),
      ('contracts', 'insurance_requirements'),
      ('contracts', 'travel_requirements'),
      ('contracts', 'special_terms'),
      ('contracts', 'internal_contract_notes'),
      ('internal_notes', 'project_id'),
      ('export_log', 'legacy_id'),
      ('release_packages', 'release_number'),
      ('release_packages', 'lifecycle_status'),
      ('release_packages', 'superseded_at'),
      ('release_packages', 'snapshot_data'),
      ('release_packages', 'content_sha256'),
      ('user_settings', 'selected_project_legacy_id'),
      ('user_settings', 'data_mode'),
      ('user_settings', 'cloud_revision'),
      ('user_settings', 'last_cloud_sync_at'),
      ('user_settings', 'cloud_cutover_completed_at'),
      ('user_settings', 'estimating_data'),
      ('import_runs', 'source_key')
    ) as required_columns(table_name, column_name)
  loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required_item.table_name
        and c.column_name = required_item.column_name
    ) then
      missing_items := array_append(missing_items, required_item.table_name || '.' || required_item.column_name);
    end if;
  end loop;

  select exists (
    select 1 from storage.buckets where id = 'project-files' and public = false
  ) into bucket_ready;

  if not bucket_ready then
    missing_items := array_append(missing_items, 'storage.project-files-private-bucket');
  end if;

  return jsonb_build_object(
    'version', '1.0-RC5.5',
    'healthy', cardinality(missing_items) = 0,
    'missing', to_jsonb(missing_items),
    'bucketReady', bucket_ready,
    'checkedAt', timezone('utc', now())
  );
end;
$$;

grant execute on function public.scopelogic_schema_health() to authenticated;

notify pgrst, 'reload schema';
