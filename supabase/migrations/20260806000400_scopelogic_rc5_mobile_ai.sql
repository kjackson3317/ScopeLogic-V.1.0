-- ScopeLogic v1.0 RC5 — Mobile and AI Drafting
-- Adds internal AI-assistance provenance to SLR entries and advances schema-health gating.

alter table public.slr_entries
  add column if not exists ai_assistance jsonb not null default '{}'::jsonb;

comment on column public.slr_entries.ai_assistance is
  'Internal provenance for reviewed AI-assisted drafting. Never rendered on client deliverables.';

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
    'version', '1.0-RC5',
    'healthy', cardinality(missing_items) = 0,
    'missing', to_jsonb(missing_items),
    'bucketReady', bucket_ready,
    'checkedAt', timezone('utc', now())
  );
end;
$$;

grant execute on function public.scopelogic_schema_health() to authenticated;

notify pgrst, 'reload schema';
