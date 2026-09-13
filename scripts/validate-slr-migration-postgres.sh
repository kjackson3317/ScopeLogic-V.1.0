#!/usr/bin/env bash
set -euo pipefail

MIGRATION="supabase/migrations/20260913000100_scopelogic_slr_parent_child_rbb.sql"
CONTAINER="scopelogic_slr_migration_validation"
IMAGE="${SLR_VALIDATION_POSTGRES_IMAGE:-postgres:17-alpine}"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ ! -f "$MIGRATION" ]]; then
  echo "Migration not found: $MIGRATION"
  exit 1
fi

printf '\n[1/6] Starting isolated PostgreSQL 17 validation container...\n'
cleanup
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker pull "$IMAGE"
fi

docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  "$IMAGE" >/dev/null

ready=false
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  echo "PostgreSQL did not become ready."
  docker logs "$CONTAINER" --tail 150 || true
  exit 1
fi

echo "PostgreSQL is ready. No Supabase project is linked or contacted."

printf '\n[2/6] Creating the minimum pre-upgrade ScopeLogic schema and legacy fixtures...\n'
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pgcrypto;
create role authenticated nologin;

create schema storage;
create table storage.buckets (
  id text primary key,
  public boolean not null default false
);
insert into storage.buckets(id, public) values ('project-files', false);

create table public.slr_entries (
  id uuid primary key,
  owner_id uuid not null,
  project_id uuid not null,
  legacy_uid text not null default '',
  sequence_number integer not null,
  display_number text not null,
  system_name text not null default '',
  scope_item text not null default '',
  systems jsonb not null default '[]'::jsonb,
  scope_concern text not null default '',
  reference text not null default '',
  resolution text not null default '',
  rfi_question text not null default '',
  rfi_number text not null default '',
  include_formal_rfi boolean not null default false,
  recommended_bid_basis text not null default '',
  recommended_bid_basis_by_system jsonb not null default '{}'::jsonb,
  checklist_scope_item text not null default '',
  checklist_scope_items_by_system jsonb not null default '{}'::jsonb,
  contractor_response text not null default '',
  contractor_response_reason text not null default '',
  ai_assistance jsonb not null default '{}'::jsonb,
  source_type text not null default ''
);

create table public.release_packages (
  id uuid primary key,
  owner_id uuid not null,
  project_id uuid not null,
  released_at timestamptz not null,
  release_number integer,
  lifecycle_status text,
  superseded_at timestamptz,
  snapshot_data jsonb not null default '{}'::jsonb,
  content_sha256 text not null default ''
);

create table public.release_deliverables (
  owner_id uuid not null,
  release_package_id uuid not null,
  deliverable_type text not null,
  sort_order integer not null default 0
);

insert into public.slr_entries (
  id, owner_id, project_id, legacy_uid, sequence_number, display_number,
  system_name, scope_item, systems, scope_concern, reference, resolution,
  rfi_question, rfi_number, include_formal_rfi,
  recommended_bid_basis, recommended_bid_basis_by_system,
  checklist_scope_item, checklist_scope_items_by_system,
  contractor_response, contractor_response_reason
) values
(
  '70000000-0000-0000-0000-000000000007',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'legacy-safety-001', 7, 'SLR-007', 'Structured Cabling',
  'Released legacy scope', '["Structured Cabling"]'::jsonb, 'Released concern', '27 10 00', '',
  'Confirm cable category.', 'RFI-004', true,
  'Provide Category 6A cabling.', '{"Structured Cabling":"Provide Category 6A cabling."}'::jsonb,
  'Confirm Category 6A is included.', '{"Structured Cabling":"Confirm Category 6A is included."}'::jsonb,
  'Included', ''
),
(
  '80000000-0000-0000-0000-000000000008',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '', 8, 'SLR-008', 'Access Control',
  'Blank-ID false-positive guard', '["Access Control"]'::jsonb, 'Must not inherit another release through a blank UID.', '28 13 00', '',
  'Confirm access control scope.', 'RFI-005', true,
  'Carry complete access control scope.', '{"Access Control":"Carry complete access control scope."}'::jsonb,
  'Confirm complete access control scope.', '{"Access Control":"Confirm complete access control scope."}'::jsonb,
  'Included', ''
),
(
  '90000000-0000-0000-0000-000000000009',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'legacy-safety-003', 9, 'SLR-009', 'CCTV',
  'Unreleased legacy scope', '["CCTV"]'::jsonb, 'This fixture has never appeared in an official release.', '28 20 00', '',
  'Confirm CCTV scope.', 'RFI-006', true,
  'Carry complete CCTV scope.', '{"CCTV":"Carry complete CCTV scope."}'::jsonb,
  'Confirm complete CCTV scope.', '{"CCTV":"Confirm complete CCTV scope."}'::jsonb,
  'Included', ''
),
(
  'a0000000-0000-0000-0000-000000000010',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'legacy-safety-004', 10, 'SLR-010', 'Fire Alarm',
  'Snapshot-only release match', '["Fire Alarm"]'::jsonb, 'Tests archived snapshot deliverable fallback.', '28 31 00', '',
  'Confirm fire alarm scope.', 'RFI-007', true,
  'Carry complete fire alarm scope.', '{"Fire Alarm":"Carry complete fire alarm scope."}'::jsonb,
  'Confirm complete fire alarm scope.', '{"Fire Alarm":"Confirm complete fire alarm scope."}'::jsonb,
  'Included', ''
);

-- SLR-007 is proven customer-visible through release_deliverables.
insert into public.release_packages (
  id, owner_id, project_id, released_at, release_number, lifecycle_status, snapshot_data, content_sha256
) values
(
  '33333333-3333-3333-3333-333333333331',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '2026-08-20T12:00:00Z', 1, 'Current',
  '{"issues":[{"uid":"legacy-safety-001","id":"SLR-007"},{"uid":"","id":"NOT-SLR-008"}],"deliverables":"legacy-invalid-shape"}'::jsonb,
  'fixture-sha-1'
),
-- SLR-010 is proven customer-visible only through the archived snapshot deliverables array.
(
  '33333333-3333-3333-3333-333333333332',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '2026-08-22T12:00:00Z', 2, 'Superseded',
  '{"issues":[{"uid":"legacy-safety-004","id":"SLR-010"}],"deliverables":["sow","clarifications","rfi","checklist"]}'::jsonb,
  'fixture-sha-2'
),
-- Deliberately malformed snapshot shape must be ignored safely.
(
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '2026-08-23T12:00:00Z', 3, 'Superseded',
  '{"issues":{},"deliverables":"rfi"}'::jsonb,
  'fixture-sha-3'
);

insert into public.release_deliverables(owner_id, release_package_id, deliverable_type, sort_order) values
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'sow', 0),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'clarifications', 1),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'rfi', 2),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'checklist', 3);
SQL

printf '\n[3/6] Applying the SLR parent/child migration to PostgreSQL 17...\n'
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$MIGRATION"

printf '\n[4/6] Verifying legacy locks, snapshot fallback, false-positive protection, and schema health...\n'
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  released public.slr_entries%rowtype;
  blank_guard public.slr_entries%rowtype;
  unreleased public.slr_entries%rowtype;
  snapshot_released public.slr_entries%rowtype;
  health jsonb;
begin
  select * into released from public.slr_entries where display_number = 'SLR-007';
  select * into blank_guard from public.slr_entries where display_number = 'SLR-008';
  select * into unreleased from public.slr_entries where display_number = 'SLR-009';
  select * into snapshot_released from public.slr_entries where display_number = 'SLR-010';

  if not released.number_locked or released.number_released_at is null then
    raise exception 'FAIL: release_deliverables-backed parent SLR number was not locked';
  end if;

  if jsonb_array_length(released.rfi_children) <> 1
     or released.rfi_children -> 0 ->> 'number' <> 'RFI-004'
     or coalesce((released.rfi_children -> 0 ->> 'locked')::boolean, false) is not true then
    raise exception 'FAIL: released legacy RFI was not preserved and locked';
  end if;

  if jsonb_array_length(released.recommend_base_bid_children) <> 1
     or released.recommend_base_bid_children -> 0 -> 'sections' -> 'Structured Cabling' ->> 'recommendation' <> 'Provide Category 6A cabling.'
     or coalesce((released.recommend_base_bid_children -> 0 -> 'sections' -> 'Structured Cabling' ->> 'locked')::boolean, false) is not true
     or coalesce((released.recommend_base_bid_children -> 0 -> 'sections' -> 'Structured Cabling' ->> 'contentReleased')::boolean, false) is not true then
    raise exception 'FAIL: released legacy RBB was not preserved and frozen';
  end if;

  if jsonb_array_length(released.contractor_checklist_children) <> 1
     or released.contractor_checklist_children -> 0 ->> 'question' <> 'Confirm Category 6A is included.'
     or coalesce((released.contractor_checklist_children -> 0 ->> 'locked')::boolean, false) is not true then
    raise exception 'FAIL: released checklist question was not preserved and locked';
  end if;

  if not snapshot_released.number_locked
     or coalesce((snapshot_released.rfi_children -> 0 ->> 'locked')::boolean, false) is not true
     or coalesce((snapshot_released.recommend_base_bid_children -> 0 -> 'sections' -> 'Fire Alarm' ->> 'locked')::boolean, false) is not true
     or coalesce((snapshot_released.contractor_checklist_children -> 0 ->> 'locked')::boolean, false) is not true then
    raise exception 'FAIL: archived snapshot deliverable fallback did not lock SLR-010';
  end if;

  if blank_guard.number_locked then
    raise exception 'FAIL: blank legacy UID created a false historical match';
  end if;

  if coalesce((blank_guard.rfi_children -> 0 ->> 'locked')::boolean, false)
     or coalesce((blank_guard.recommend_base_bid_children -> 0 -> 'sections' -> 'Access Control' ->> 'locked')::boolean, false)
     or coalesce((blank_guard.contractor_checklist_children -> 0 ->> 'locked')::boolean, false) then
    raise exception 'FAIL: blank-ID fixture inherited customer-visible locks';
  end if;

  if unreleased.number_locked
     or coalesce((unreleased.rfi_children -> 0 ->> 'locked')::boolean, false)
     or coalesce((unreleased.recommend_base_bid_children -> 0 -> 'sections' -> 'CCTV' ->> 'locked')::boolean, false)
     or coalesce((unreleased.contractor_checklist_children -> 0 ->> 'locked')::boolean, false) then
    raise exception 'FAIL: unreleased legacy content was incorrectly locked';
  end if;

  if to_regclass('public.slr_entries_rfi_children_gin_idx') is null
     or to_regclass('public.slr_entries_rbb_children_gin_idx') is null then
    raise exception 'FAIL: SLR JSONB indexes were not created';
  end if;

  health := public.scopelogic_schema_health();
  if health ->> 'version' <> '1.0-RC5.5' then
    raise exception 'FAIL: schema health version changed unexpectedly: %', health ->> 'version';
  end if;
  if coalesce((health ->> 'bucketReady')::boolean, false) is not true then
    raise exception 'FAIL: schema health did not recognize the private project-files bucket';
  end if;
  if (health -> 'missing') ? 'slr_entries.rfi_children'
     or (health -> 'missing') ? 'slr_entries.recommend_base_bid_children'
     or (health -> 'missing') ? 'slr_entries.contractor_checklist_children'
     or (health -> 'missing') ? 'slr_entries.number_locked'
     or (health -> 'missing') ? 'slr_entries.number_released_at'
     or (health -> 'missing') ? 'slr_entries.rbb_scope_letter_map' then
    raise exception 'FAIL: schema health does not recognize all SLR parent/child columns: %', health -> 'missing';
  end if;

  raise notice 'PASS: first migration application preserved released history and left unreleased records editable.';
end $$;

create table public.slr_validation_before_reapply as
select id, rfi_children, recommend_base_bid_children, contractor_checklist_children,
       number_locked, number_released_at, rbb_scope_letter_map
from public.slr_entries;
SQL

printf '\n[5/6] Reapplying the migration to verify idempotence...\n'
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$MIGRATION"

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if exists (
    select 1
    from public.slr_entries current_row
    join public.slr_validation_before_reapply before_row using (id)
    where current_row.rfi_children is distinct from before_row.rfi_children
       or current_row.recommend_base_bid_children is distinct from before_row.recommend_base_bid_children
       or current_row.contractor_checklist_children is distinct from before_row.contractor_checklist_children
       or current_row.number_locked is distinct from before_row.number_locked
       or current_row.number_released_at is distinct from before_row.number_released_at
       or current_row.rbb_scope_letter_map is distinct from before_row.rbb_scope_letter_map
  ) then
    raise exception 'FAIL: reapplying the migration changed already-migrated SLR records';
  end if;

  raise notice 'PASS: migration is idempotent for already-migrated SLR records.';
end $$;
SQL

printf '\n[6/6] Cleaning up isolated PostgreSQL validation container...\n'
cleanup
trap - EXIT

printf '\nSLR POSTGRES MIGRATION VALIDATION PASSED. Production was not contacted or modified.\n'
