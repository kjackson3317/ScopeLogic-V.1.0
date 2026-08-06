-- ScopeLogic v1.0 — Production Closeout
-- Adds immutable numbered official releases and final schema-health reporting.

alter table public.release_packages
  add column if not exists release_number integer,
  add column if not exists lifecycle_status text not null default 'Current',
  add column if not exists superseded_at timestamptz,
  add column if not exists snapshot_data jsonb not null default '{}'::jsonb,
  add column if not exists content_sha256 text not null default '';

with numbered as (
  select id,
         row_number() over (partition by project_id order by released_at, created_at, id)::integer as assigned_number,
         row_number() over (partition by project_id order by released_at desc, created_at desc, id desc)::integer as newest_rank
  from public.release_packages
)
update public.release_packages rp
set release_number = coalesce(rp.release_number, numbered.assigned_number),
    lifecycle_status = case when numbered.newest_rank = 1 then 'Current' else 'Superseded' end,
    superseded_at = case when numbered.newest_rank = 1 then null else coalesce(rp.superseded_at, timezone('utc', now())) end
from numbered
where rp.id = numbered.id;

alter table public.release_packages
  alter column release_number set not null;

alter table public.release_packages
  drop constraint if exists release_packages_lifecycle_status_check;
alter table public.release_packages
  add constraint release_packages_lifecycle_status_check
  check (lifecycle_status in ('Current', 'Superseded'));

create unique index if not exists release_packages_project_release_number_uidx
  on public.release_packages(project_id, release_number);
create index if not exists release_packages_project_status_idx
  on public.release_packages(project_id, lifecycle_status, release_number desc);

create or replace function public.protect_release_package_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Official release records are immutable and cannot be deleted.';
  end if;

  if new.id <> old.id
     or new.owner_id <> old.owner_id
     or new.project_id <> old.project_id
     or new.revision <> old.revision
     or new.version_date is distinct from old.version_date
     or new.release_notes <> old.release_notes
     or new.filename <> old.filename
     or new.storage_path is distinct from old.storage_path
     or new.released_at <> old.released_at
     or new.created_at <> old.created_at
     or new.release_number <> old.release_number
     or new.snapshot_data <> old.snapshot_data
     or new.content_sha256 <> old.content_sha256
     or new.status <> old.status then
    raise exception 'Official release content is immutable.';
  end if;

  if old.lifecycle_status = 'Superseded' then
    raise exception 'A superseded official release cannot be changed.';
  end if;

  if new.lifecycle_status <> 'Superseded' or new.superseded_at is null then
    raise exception 'The only permitted release update is Current to Superseded.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_release_package_immutability_update on public.release_packages;
create trigger protect_release_package_immutability_update
before update on public.release_packages
for each row execute function public.protect_release_package_immutability();

drop trigger if exists protect_release_package_immutability_delete on public.release_packages;
create trigger protect_release_package_immutability_delete
before delete on public.release_packages
for each row execute function public.protect_release_package_immutability();

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
    'version', '1.0',
    'healthy', cardinality(missing_items) = 0,
    'missing', to_jsonb(missing_items),
    'bucketReady', bucket_ready,
    'checkedAt', timezone('utc', now())
  );
end;
$$;

grant execute on function public.scopelogic_schema_health() to authenticated;

create or replace function public.is_immutable_release_object(target_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.release_packages rp
    where rp.owner_id = auth.uid()
      and rp.storage_path = target_name
  );
$$;

grant execute on function public.is_immutable_release_object(text) to authenticated;

drop policy if exists "project_files_update_own" on storage.objects;
create policy "project_files_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not public.is_immutable_release_object(name)
)
with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not public.is_immutable_release_object(name)
);

drop policy if exists "project_files_delete_own" on storage.objects;
create policy "project_files_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not public.is_immutable_release_object(name)
);

revoke insert, update, delete on table public.release_packages from authenticated;
revoke insert, update, delete on table public.release_deliverables from authenticated;
grant select on table public.release_packages, public.release_deliverables to authenticated;

create or replace function public.create_scopelogic_official_release(
  p_project_legacy_id text,
  p_revision text,
  p_version_date date,
  p_release_notes text,
  p_filename text,
  p_storage_path text,
  p_snapshot_data jsonb,
  p_content_sha256 text,
  p_deliverables text[]
)
returns table(release_id uuid, release_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_uuid uuid := auth.uid();
  project_uuid uuid;
  next_number integer;
  created_release_id uuid;
begin
  if owner_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select p.id into project_uuid
  from public.projects p
  where p.owner_id = owner_uuid
    and p.legacy_id = p_project_legacy_id;

  if project_uuid is null then
    raise exception 'The project could not be resolved for the official release archive.';
  end if;

  perform pg_advisory_xact_lock(hashtext(project_uuid::text));

  select coalesce(max(rp.release_number), 0) + 1
  into next_number
  from public.release_packages rp
  where rp.project_id = project_uuid;

  update public.release_packages
  set lifecycle_status = 'Superseded',
      superseded_at = timezone('utc', now())
  where project_id = project_uuid
    and lifecycle_status = 'Current';

  insert into public.release_packages (
    owner_id, project_id, revision, version_date, status, release_notes,
    filename, storage_path, release_number, lifecycle_status,
    snapshot_data, content_sha256
  ) values (
    owner_uuid, project_uuid, coalesce(nullif(p_revision, ''), 'Rev 0'), p_version_date,
    'Official Release', coalesce(p_release_notes, ''), p_filename, p_storage_path,
    next_number, 'Current', coalesce(p_snapshot_data, '{}'::jsonb), coalesce(p_content_sha256, '')
  ) returning id into created_release_id;

  insert into public.release_deliverables (owner_id, release_package_id, deliverable_type, sort_order)
  select owner_uuid, created_release_id, deliverable, ordinal::integer - 1
  from unnest(coalesce(p_deliverables, array[]::text[])) with ordinality as selected(deliverable, ordinal);

  return query select created_release_id, next_number;
end;
$$;

grant execute on function public.create_scopelogic_official_release(text, text, date, text, text, text, jsonb, text, text[]) to authenticated;

notify pgrst, 'reload schema';
