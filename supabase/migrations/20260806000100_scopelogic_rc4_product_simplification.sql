-- ScopeLogic v1.0 RC4 — Product Simplification and Multi-System SLR Support
-- This migration is additive and preserves all legacy RC3.1 data.

alter table public.slr_entries
  add column if not exists systems jsonb not null default '[]'::jsonb,
  add column if not exists recommended_bid_basis_by_system jsonb not null default '{}'::jsonb;

update public.slr_entries
set systems = jsonb_build_array(coalesce(nullif(system_name, ''), 'Structured Cabling'))
where systems is null or jsonb_typeof(systems) <> 'array' or jsonb_array_length(systems) = 0;

update public.slr_entries
set recommended_bid_basis_by_system = jsonb_build_object(
  coalesce(nullif(system_name, ''), 'Structured Cabling'),
  coalesce(recommended_bid_basis, '')
)
where recommended_bid_basis_by_system is null
   or jsonb_typeof(recommended_bid_basis_by_system) <> 'object'
   or recommended_bid_basis_by_system = '{}'::jsonb;

alter table public.contracts
  add column if not exists primary_contact_legacy_id text not null default '',
  add column if not exists agreement_number text not null default '',
  add column if not exists purchase_order_number text not null default '',
  add column if not exists contract_date date,
  add column if not exists notice_to_proceed_date date,
  add column if not exists original_contract_amount text not null default '',
  add column if not exists approved_additional_services text not null default '',
  add column if not exists amount_invoiced text not null default '',
  add column if not exists amount_paid text not null default '',
  add column if not exists billing_method text not null default '',
  add column if not exists billing_notes text not null default '',
  add column if not exists contracted_service text not null default '',
  add column if not exists included_deliverables text not null default '',
  add column if not exists included_review_cycles text not null default '',
  add column if not exists project_phase text not null default '',
  add column if not exists anticipated_completion_date date,
  add column if not exists next_client_action text not null default '',
  add column if not exists agreement_uploaded boolean not null default false,
  add column if not exists insurance_requirements text not null default '',
  add column if not exists travel_requirements text not null default '',
  add column if not exists special_terms text not null default '',
  add column if not exists internal_contract_notes text not null default '';

-- Carry useful legacy contract values forward without overwriting RC4 entries.
update public.contracts
set
  agreement_number = case when agreement_number = '' then contract_number else agreement_number end,
  original_contract_amount = case when original_contract_amount = '' then amount else original_contract_amount end,
  contracted_service = case when contracted_service = '' then offering else contracted_service end,
  anticipated_completion_date = coalesce(anticipated_completion_date, target_completion),
  internal_contract_notes = case when internal_contract_notes = '' then notes else internal_contract_notes end,
  project_phase = case when project_phase = '' then status else project_phase end;

create index if not exists slr_entries_project_systems_gin_idx
  on public.slr_entries using gin (systems);

-- Replace the health RPC so the browser can distinguish RC4 from RC3.1.
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
      ('user_settings', 'selected_project_legacy_id'),
      ('user_settings', 'data_mode'),
      ('user_settings', 'cloud_revision'),
      ('user_settings', 'last_cloud_sync_at'),
      ('user_settings', 'cloud_cutover_completed_at'),
      ('import_runs', 'source_key')
    ) as required_columns(table_name, column_name)
  loop
    if not exists (
      select 1
      from information_schema.columns c
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
    'version', 'RC4',
    'healthy', cardinality(missing_items) = 0,
    'missing', to_jsonb(missing_items),
    'bucketReady', bucket_ready,
    'checkedAt', timezone('utc', now())
  );
end;
$$;

grant execute on function public.scopelogic_schema_health() to authenticated;
grant select, insert, update, delete on table public.slr_entries, public.contracts to authenticated;

notify pgrst, 'reload schema';
