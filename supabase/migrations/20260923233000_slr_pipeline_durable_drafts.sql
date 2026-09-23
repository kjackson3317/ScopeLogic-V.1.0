-- ScopeLogic SLR pipeline hardening: durable drafts, draft CL/VE promotion,
-- collision-safe deliverable numbering, and persistent generated-clarification linkage.

create table if not exists public.slr_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  legacy_uid text not null,
  display_number text not null default '',
  draft_data jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, legacy_uid)
);

create index if not exists slr_drafts_project_id_idx on public.slr_drafts(project_id);

alter table public.slr_drafts enable row level security;
drop policy if exists slr_drafts_workspace_access on public.slr_drafts;
create policy slr_drafts_workspace_access on public.slr_drafts
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_project(project_id))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_project(project_id))
);

create table if not exists public.slr_draft_deliverable_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  slr_legacy_uid text not null,
  draft_uid text not null default gen_random_uuid()::text,
  deliverable_type text not null check (deliverable_type in ('CL','VE')),
  system_name text not null default 'Other',
  title text not null default '',
  content text not null default '',
  impact_considerations text not null default '',
  reference text not null default '',
  status text not null default 'Draft',
  response text not null default '',
  response_source text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, slr_legacy_uid, draft_uid)
);

create index if not exists slr_draft_deliverable_items_project_slr_idx
  on public.slr_draft_deliverable_items(project_id, slr_legacy_uid);

alter table public.slr_draft_deliverable_items enable row level security;
drop policy if exists slr_draft_deliverable_items_workspace_access on public.slr_draft_deliverable_items;
create policy slr_draft_deliverable_items_workspace_access on public.slr_draft_deliverable_items
for all to authenticated
using (
  owner_id = (select private.current_workspace_owner())
  and (select private.can_access_project(project_id))
)
with check (
  owner_id = (select private.current_workspace_owner())
  and created_by_user_id = (select auth.uid())
  and (select private.can_access_project(project_id))
);

create or replace function private.next_master_deliverable_sequence(
  p_master_project_id uuid,
  p_deliverable_type text,
  p_exclude_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate integer := 1;
  candidate_display text;
begin
  loop
    candidate_display := p_deliverable_type || '-' || lpad(candidate::text, 3, '0');
    exit when not exists (
      select 1
      from public.master_project_deliverable_items d
      where d.master_project_id = p_master_project_id
        and d.deliverable_type = p_deliverable_type
        and d.sequence_number = candidate
        and (p_exclude_id is null or d.id <> p_exclude_id)
    ) and not exists (
      select 1
      from public.master_project_deliverable_items d
      where d.master_project_id = p_master_project_id
        and d.display_number = candidate_display
        and (p_exclude_id is null or d.id <> p_exclude_id)
    );
    candidate := candidate + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function private.guard_master_deliverable_number_collision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate integer;
begin
  if coalesce(new.display_number, '') like '__SLR_SYNC__%' then
    return new;
  end if;

  if new.sequence_number is null
     or new.sequence_number < 1
     or coalesce(new.display_number, '') = ''
     or exists (
       select 1 from public.master_project_deliverable_items d
       where d.master_project_id = new.master_project_id
         and d.deliverable_type = new.deliverable_type
         and d.sequence_number = new.sequence_number
         and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     )
     or exists (
       select 1 from public.master_project_deliverable_items d
       where d.master_project_id = new.master_project_id
         and d.display_number = new.display_number
         and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     )
  then
    candidate := private.next_master_deliverable_sequence(new.master_project_id, new.deliverable_type, new.id);
    new.sequence_number := candidate;
    new.display_number := new.deliverable_type || '-' || lpad(candidate::text, 3, '0');
    new.sort_order := candidate;
  end if;

  return new;
end;
$$;

drop trigger if exists master_project_deliverable_items_guard_number_collision on public.master_project_deliverable_items;
create trigger master_project_deliverable_items_guard_number_collision
before insert or update of master_project_id, deliverable_type, sequence_number, display_number
on public.master_project_deliverable_items
for each row execute function private.guard_master_deliverable_number_collision();

-- Generated Clarifications must remain linked to their SLR so later SLR edits update the same row.
drop trigger if exists master_project_deliverable_items_decouple_slr_cl_insert on public.master_project_deliverable_items;

update public.master_project_deliverable_items d
set source_child_uid = 'slr:clarification'
where d.deliverable_type = 'CL'
  and d.source_origin = 'slr:clarification'
  and coalesce(d.source_child_uid, '') = ''
  and exists (
    select 1
    from public.slr_entries s
    where s.master_finding_id = d.related_master_finding_id
      and coalesce(s.include_clarification, false) = true
  );

create or replace function private.reconcile_master_generated_deliverable_numbers(p_master_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  temp_base integer;
  temp_seq integer;
begin
  select coalesce(max(sequence_number), 0) + 1000
  into temp_base
  from public.master_project_deliverable_items
  where master_project_id = p_master_project_id;

  temp_seq := temp_base;
  for rec in
    with mappings as (
      select distinct on (d.id)
        d.id,
        d.deliverable_type,
        nullif(child->>'number','') as desired_number,
        coalesce((child->>'locked')::boolean, false) as locked
      from public.slr_entries s
      join public.projects p on p.id = s.project_id
      cross join lateral jsonb_array_elements(coalesce(s.rfi_children, '[]'::jsonb)) child
      join public.master_project_deliverable_items d
        on d.related_master_finding_id = s.master_finding_id
       and d.source_child_uid = 'rfi:' || coalesce(child->>'uid','')
      where p.master_project_id = p_master_project_id
        and d.deliverable_type = 'RFI'

      union all

      select distinct on (d.id)
        d.id,
        d.deliverable_type,
        nullif(section.value->>'displayNumber','') as desired_number,
        (coalesce((section.value->>'locked')::boolean, false)
          or coalesce((section.value->>'contentReleased')::boolean, false)) as locked
      from public.slr_entries s
      join public.projects p on p.id = s.project_id
      cross join lateral jsonb_array_elements(coalesce(s.recommend_base_bid_children, '[]'::jsonb)) rbb
      cross join lateral jsonb_each(coalesce(rbb->'sections', '{}'::jsonb)) section
      join public.master_project_deliverable_items d
        on d.related_master_finding_id = s.master_finding_id
       and d.source_child_uid = 'rbb:' || coalesce(section.value->>'uid','')
      where p.master_project_id = p_master_project_id
        and d.deliverable_type = 'RBB'
    )
    select * from mappings
    where desired_number is not null and not locked
    order by deliverable_type, desired_number, id
  loop
    temp_seq := temp_seq + 1;
    update public.master_project_deliverable_items
    set display_number = '__SLR_SYNC__' || id::text,
        sequence_number = temp_seq,
        sort_order = temp_seq
    where id = rec.id;
  end loop;

  for rec in
    with mappings as (
      select distinct on (d.id)
        d.id,
        d.deliverable_type,
        nullif(child->>'number','') as desired_number,
        coalesce((child->>'locked')::boolean, false) as locked
      from public.slr_entries s
      join public.projects p on p.id = s.project_id
      cross join lateral jsonb_array_elements(coalesce(s.rfi_children, '[]'::jsonb)) child
      join public.master_project_deliverable_items d
        on d.related_master_finding_id = s.master_finding_id
       and d.source_child_uid = 'rfi:' || coalesce(child->>'uid','')
      where p.master_project_id = p_master_project_id
        and d.deliverable_type = 'RFI'

      union all

      select distinct on (d.id)
        d.id,
        d.deliverable_type,
        nullif(section.value->>'displayNumber','') as desired_number,
        (coalesce((section.value->>'locked')::boolean, false)
          or coalesce((section.value->>'contentReleased')::boolean, false)) as locked
      from public.slr_entries s
      join public.projects p on p.id = s.project_id
      cross join lateral jsonb_array_elements(coalesce(s.recommend_base_bid_children, '[]'::jsonb)) rbb
      cross join lateral jsonb_each(coalesce(rbb->'sections', '{}'::jsonb)) section
      join public.master_project_deliverable_items d
        on d.related_master_finding_id = s.master_finding_id
       and d.source_child_uid = 'rbb:' || coalesce(section.value->>'uid','')
      where p.master_project_id = p_master_project_id
        and d.deliverable_type = 'RBB'
    )
    select * from mappings
    where desired_number is not null and not locked
    order by deliverable_type, desired_number, id
  loop
    update public.master_project_deliverable_items
    set display_number = rec.desired_number,
        sequence_number = 0,
        sort_order = 0
    where id = rec.id;
  end loop;
end;
$$;

create or replace function private.reconcile_slr_generated_deliverable_numbers_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  master_id uuid;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  select p.master_project_id into master_id from public.projects p where p.id = new.project_id;
  if master_id is not null then
    perform private.reconcile_master_generated_deliverable_numbers(master_id);
  end if;
  return new;
end;
$$;

drop trigger if exists zzz_slr_entries_reconcile_generated_numbers on public.slr_entries;
create trigger zzz_slr_entries_reconcile_generated_numbers
after insert or update of rfi_children, recommend_base_bid_children, master_finding_id
on public.slr_entries
for each row execute function private.reconcile_slr_generated_deliverable_numbers_trigger();

create or replace function private.promote_slr_draft_deliverables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_finding_id uuid;
  master_id uuid;
  draft_row record;
  seq integer;
begin
  if pg_trigger_depth() > 1 then return new; end if;

  select s.master_finding_id, p.master_project_id
  into current_finding_id, master_id
  from public.slr_entries s
  join public.projects p on p.id = s.project_id
  where s.id = new.id;

  if current_finding_id is null or master_id is null then return new; end if;

  for draft_row in
    select *
    from public.slr_draft_deliverable_items
    where project_id = new.project_id
      and slr_legacy_uid = new.legacy_uid
    order by sort_order, created_at, id
  loop
    seq := private.next_master_deliverable_sequence(master_id, draft_row.deliverable_type, null);
    insert into public.master_project_deliverable_items (
      owner_id, master_project_id, created_by_user_id, related_master_finding_id,
      deliverable_type, sequence_number, display_number, system_name, title, content,
      impact_considerations, reference, status, response, response_date, response_source,
      client_facing, sort_order, source_child_uid, source_origin
    ) values (
      draft_row.owner_id, master_id, draft_row.created_by_user_id, current_finding_id,
      draft_row.deliverable_type, seq,
      draft_row.deliverable_type || '-' || lpad(seq::text, 3, '0'),
      draft_row.system_name, draft_row.title, draft_row.content,
      draft_row.impact_considerations, draft_row.reference, draft_row.status,
      draft_row.response, null, draft_row.response_source,
      true, seq, '', 'slr:draft:' || draft_row.id::text
    );
  end loop;

  delete from public.slr_draft_deliverable_items
  where project_id = new.project_id
    and slr_legacy_uid = new.legacy_uid;

  return new;
end;
$$;

-- Trigger order is intentional: sync_master (s...) -> promote draft CL/VE (zy...) -> review sync (zz...).
drop trigger if exists zy_slr_entries_promote_draft_deliverables on public.slr_entries;
create trigger zy_slr_entries_promote_draft_deliverables
after insert or update on public.slr_entries
for each row execute function private.promote_slr_draft_deliverables();
