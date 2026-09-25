-- Repair project-package official release creation after proposal lifecycle added
-- the required release_packages.document_key column.
--
-- Project package releases and proposal releases share release_packages, but
-- they have separate document identities and therefore separate numbering /
-- Current-vs-Superseded lifecycles.

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
  package_document_key constant text := 'project-package';
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

  -- Match proposal-release locking semantics, but isolate the project package
  -- from every proposal document identity under the same project.
  perform pg_advisory_xact_lock(
    hashtext(project_uuid::text || ':' || package_document_key)
  );

  select coalesce(max(rp.release_number), 0) + 1
  into next_number
  from public.release_packages rp
  where rp.project_id = project_uuid
    and rp.document_key = package_document_key;

  update public.release_packages
  set lifecycle_status = 'Superseded',
      superseded_at = timezone('utc', now())
  where project_id = project_uuid
    and document_key = package_document_key
    and lifecycle_status = 'Current';

  insert into public.release_packages (
    owner_id,
    project_id,
    revision,
    version_date,
    status,
    release_notes,
    filename,
    storage_path,
    release_number,
    lifecycle_status,
    snapshot_data,
    content_sha256,
    document_key,
    document_type,
    generated_by
  ) values (
    owner_uuid,
    project_uuid,
    coalesce(nullif(p_revision, ''), 'Rev 0'),
    p_version_date,
    'Official Release',
    coalesce(p_release_notes, ''),
    p_filename,
    p_storage_path,
    next_number,
    'Current',
    coalesce(p_snapshot_data, '{}'::jsonb),
    coalesce(p_content_sha256, ''),
    package_document_key,
    'project-package',
    owner_uuid
  )
  returning id into created_release_id;

  insert into public.release_deliverables (
    owner_id,
    release_package_id,
    deliverable_type,
    sort_order
  )
  select
    owner_uuid,
    created_release_id,
    deliverable,
    ordinal::integer - 1
  from unnest(coalesce(p_deliverables, array[]::text[]))
    with ordinality as selected(deliverable, ordinal);

  return query
    select created_release_id, next_number;
end;
$$;

revoke all on function public.create_scopelogic_official_release(
  text, text, date, text, text, text, jsonb, text, text[]
) from public;

revoke all on function public.create_scopelogic_official_release(
  text, text, date, text, text, text, jsonb, text, text[]
) from anon;

grant execute on function public.create_scopelogic_official_release(
  text, text, date, text, text, text, jsonb, text, text[]
) to authenticated;

notify pgrst, 'reload schema';
