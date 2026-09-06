-- RC5.7 preserve existing RC5.6 project content when the Project Library moves to Master Projects.
-- Existing SLRs and project documents become shared Master Project baseline data.
-- Original engagement rows remain intact for historical/customer-specific use.

alter table public.master_project_findings
  add column if not exists source_slr_entry_id uuid,
  add column if not exists custom_system text not null default '',
  add column if not exists status text not null default 'Open',
  add column if not exists recommended_bid_basis text not null default '',
  add column if not exists rfi_number text not null default '',
  add column if not exists resolution text not null default '',
  add column if not exists snippet_number text not null default '',
  add column if not exists include_sow boolean not null default true,
  add column if not exists include_clarification boolean not null default true,
  add column if not exists include_formal_rfi boolean not null default false,
  add column if not exists checklist_scope_item text not null default '',
  add column if not exists checklist_scope_items_by_system jsonb not null default '{}'::jsonb,
  add column if not exists contractor_response text not null default 'Included',
  add column if not exists contractor_response_reason text not null default '',
  add column if not exists ai_assistance jsonb not null default '{}'::jsonb;

create unique index if not exists master_project_findings_source_slr_uidx
  on public.master_project_findings(source_slr_entry_id)
  where source_slr_entry_id is not null;

alter table public.master_project_documents
  add column if not exists source_project_document_id uuid;

create unique index if not exists master_project_documents_source_doc_uidx
  on public.master_project_documents(source_project_document_id)
  where source_project_document_id is not null;

insert into public.master_project_findings (
  owner_id,
  master_project_id,
  source_slr_entry_id,
  legacy_uid,
  sequence_number,
  display_number,
  systems,
  custom_system,
  scope_item,
  status,
  scope_concern,
  recommended_bid_basis,
  recommended_bid_basis_by_system,
  rfi_question,
  reason_basis,
  reference,
  source_type,
  rfi_number,
  resolution,
  snippet_number,
  include_sow,
  include_clarification,
  include_formal_rfi,
  checklist_scope_item,
  checklist_scope_items_by_system,
  contractor_response,
  contractor_response_reason,
  ai_assistance,
  created_at,
  updated_at
)
select
  s.owner_id,
  p.master_project_id,
  s.id,
  s.legacy_uid,
  s.sequence_number,
  s.display_number,
  case
    when jsonb_typeof(s.systems) = 'array' and jsonb_array_length(s.systems) > 0 then s.systems
    else jsonb_build_array(coalesce(nullif(s.system_name, ''), 'Structured Cabling'))
  end,
  s.custom_system,
  s.scope_item,
  s.status,
  s.scope_concern,
  s.recommended_bid_basis,
  coalesce(s.recommended_bid_basis_by_system, '{}'::jsonb),
  s.rfi_question,
  s.reason_basis,
  s.reference,
  s.source_type,
  s.rfi_number,
  s.resolution,
  s.snippet_number,
  s.include_sow,
  s.include_clarification,
  s.include_formal_rfi,
  s.checklist_scope_item,
  coalesce(s.checklist_scope_items_by_system, '{}'::jsonb),
  s.contractor_response,
  s.contractor_response_reason,
  coalesce(s.ai_assistance, '{}'::jsonb),
  s.created_at,
  s.updated_at
from public.slr_entries s
join public.projects p on p.id = s.project_id
where p.master_project_id is not null
on conflict (source_slr_entry_id) where source_slr_entry_id is not null do nothing;

insert into public.master_project_documents (
  owner_id,
  master_project_id,
  source_project_document_id,
  legacy_id,
  document_type,
  display_name,
  revision,
  issue_date,
  is_current,
  notes,
  original_filename,
  mime_type,
  size_bytes,
  storage_path,
  created_at,
  updated_at
)
select
  d.owner_id,
  p.master_project_id,
  d.id,
  d.legacy_id,
  d.document_type,
  d.display_name,
  d.revision,
  d.issue_date,
  d.is_current,
  d.notes,
  d.original_filename,
  d.mime_type,
  d.size_bytes,
  d.storage_path,
  d.created_at,
  d.updated_at
from public.project_documents d
join public.projects p on p.id = d.project_id
where p.master_project_id is not null
on conflict (source_project_document_id) where source_project_document_id is not null do nothing;

-- Preserve meaningful legacy project-level notes as Master Project notes when the
-- new Master record does not already contain notes. Engagement-specific contract
-- notes remain on their engagement and are not copied here.
with legacy_notes as (
  select
    p.master_project_id,
    string_agg(n.notes, E'\n\n---\n\n' order by p.created_at) as notes
  from public.projects p
  join public.internal_notes n on n.project_id = p.id
  where p.master_project_id is not null
    and btrim(replace(coalesce(n.notes, ''), '<br>', '')) <> ''
  group by p.master_project_id
)
update public.master_projects mp
set notes = ln.notes,
    updated_at = timezone('utc', now())
from legacy_notes ln
where mp.id = ln.master_project_id
  and btrim(coalesce(mp.notes, '')) = '';

comment on column public.master_project_findings.source_slr_entry_id is
  'Migration provenance for an RC5.6 SLR copied into the shared Master Project baseline.';
comment on column public.master_project_documents.source_project_document_id is
  'Migration provenance for an RC5.6 project document copied into the shared Master Project baseline.';

notify pgrst, 'reload schema';
