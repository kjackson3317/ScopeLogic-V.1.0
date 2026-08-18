-- ScopeLogic RC5.6 - proposal document identities, immutable quote revisions and audit snapshots.

alter table public.release_packages
  add column if not exists document_key text,
  add column if not exists document_type text not null default 'project-package',
  add column if not exists proposal_mode text,
  add column if not exists quote_revision_number integer,
  add column if not exists generated_by uuid references auth.users(id),
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references auth.users(id);

update public.release_packages
set document_key = coalesce(document_key, 'project-package')
where document_key is null;

alter table public.release_packages alter column document_key set not null;

drop index if exists public.release_packages_project_release_number_uidx;
create unique index if not exists release_packages_document_release_number_uidx
  on public.release_packages(project_id, document_key, release_number);
create index if not exists release_packages_document_history_idx
  on public.release_packages(project_id, document_key, release_number desc);

create table if not exists public.release_quote_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  release_package_id uuid not null references public.release_packages(id) on delete restrict,
  quote_legacy_id text not null,
  quote_number text not null,
  quote_name text not null,
  quote_revision_number integer not null,
  quote_snapshot jsonb not null,
  base_total numeric(14,2) not null default 0,
  included boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (release_package_id, quote_legacy_id)
);

alter table public.release_quote_revisions enable row level security;
create policy "Owners read release quote revisions" on public.release_quote_revisions
  for select to authenticated using ((select auth.uid()) = owner_id);
revoke insert, update, delete on public.release_quote_revisions from authenticated;
grant select on public.release_quote_revisions to authenticated;

create or replace function public.protect_release_quote_revision_immutability()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Official proposal quote snapshots are immutable.';
end;
$$;
drop trigger if exists protect_release_quote_revision_update on public.release_quote_revisions;
create trigger protect_release_quote_revision_update before update or delete on public.release_quote_revisions
for each row execute function public.protect_release_quote_revision_immutability();

create or replace function public.create_scopelogic_proposal_release(
  p_project_legacy_id text,
  p_document_key text,
  p_document_type text,
  p_proposal_mode text,
  p_revision text,
  p_quote_revision_number integer,
  p_version_date date,
  p_filename text,
  p_storage_path text,
  p_snapshot_data jsonb,
  p_content_sha256 text,
  p_quote_revisions jsonb
)
returns table(release_id uuid, release_number integer)
language plpgsql security definer set search_path = '' as $$
declare
  owner_uuid uuid := auth.uid(); project_uuid uuid; next_number integer; created_release_id uuid;
begin
  if owner_uuid is null then raise exception 'Authentication is required.'; end if;
  select p.id into project_uuid from public.projects p
  where p.owner_id = owner_uuid and p.legacy_id = p_project_legacy_id;
  if project_uuid is null then raise exception 'Project not found.'; end if;
  if coalesce(trim(p_document_key), '') = '' then raise exception 'Document identity is required.'; end if;
  perform pg_advisory_xact_lock(hashtext(project_uuid::text || ':' || p_document_key));
  select coalesce(max(rp.release_number), 0) + 1 into next_number
  from public.release_packages rp where rp.project_id = project_uuid and rp.document_key = p_document_key;
  update public.release_packages set lifecycle_status='Superseded', superseded_at=timezone('utc', now())
  where project_id=project_uuid and document_key=p_document_key and lifecycle_status='Current';
  insert into public.release_packages(owner_id,project_id,revision,version_date,status,release_notes,filename,storage_path,
    release_number,lifecycle_status,snapshot_data,content_sha256,document_key,document_type,proposal_mode,
    quote_revision_number,generated_by)
  values(owner_uuid,project_uuid,coalesce(nullif(p_revision,''),'Rev 0'),p_version_date,'Generated','',p_filename,p_storage_path,
    next_number,'Current',coalesce(p_snapshot_data,'{}'::jsonb),coalesce(p_content_sha256,''),p_document_key,
    coalesce(nullif(p_document_type,''),'proposal'),p_proposal_mode,p_quote_revision_number,owner_uuid)
  returning id into created_release_id;
  insert into public.release_quote_revisions(owner_id,release_package_id,quote_legacy_id,quote_number,quote_name,
    quote_revision_number,quote_snapshot,base_total,included)
  select owner_uuid,created_release_id,x->>'id',x->>'number',x->>'name',coalesce((x->>'revisionNumber')::integer,0),
    x->'snapshot',coalesce((x->>'total')::numeric,0),coalesce((x->>'included')::boolean,true)
  from jsonb_array_elements(coalesce(p_quote_revisions,'[]'::jsonb)) x;
  return query select created_release_id,next_number;
end;
$$;
revoke all on function public.create_scopelogic_proposal_release(text,text,text,text,text,integer,date,text,text,jsonb,text,jsonb) from public;
grant execute on function public.create_scopelogic_proposal_release(text,text,text,text,text,integer,date,text,text,jsonb,text,jsonb) to authenticated;

notify pgrst, 'reload schema';

