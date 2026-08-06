-- ScopeLogic v1.0 RC4.1 — Matrix and Checklist Refinement
-- Additive hotfix: preserves RC4 data while supporting one-row multi-system matrices
-- and a separate Contractor Checklist Scope Item for each selected system.

alter table public.slr_entries
  add column if not exists checklist_scope_items_by_system jsonb not null default '{}'::jsonb;

-- Preserve existing RC4 checklist language. For a multi-system RC4 SLR, copy the
-- former shared checklist item into each selected system so no scope is lost.
update public.slr_entries as entry
set checklist_scope_items_by_system = coalesce((
  select jsonb_object_agg(system_key, coalesce(entry.checklist_scope_item, ''))
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(entry.systems) = 'array' then
        case
          when jsonb_array_length(entry.systems) > 0 then entry.systems
          else jsonb_build_array(coalesce(nullif(entry.system_name, ''), 'Structured Cabling'))
        end
      else jsonb_build_array(coalesce(nullif(entry.system_name, ''), 'Structured Cabling'))
    end
  ) as selected_system(system_key)
), '{}'::jsonb)
where checklist_scope_items_by_system is null
   or jsonb_typeof(checklist_scope_items_by_system) <> 'object'
   or checklist_scope_items_by_system = '{}'::jsonb;

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
    'version', 'RC4.1',
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
