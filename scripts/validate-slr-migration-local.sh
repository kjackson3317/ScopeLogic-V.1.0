#!/usr/bin/env bash
set -euo pipefail

PREVIOUS_VERSION="20260908033754"

printf '\n[1/6] Starting local Supabase stack...\n'
npx supabase start >/tmp/scopelogic-supabase-start.log 2>&1 || {
  cat /tmp/scopelogic-supabase-start.log
  exit 1
}
cat /tmp/scopelogic-supabase-start.log

printf '\n[2/6] Resetting local database to the migration immediately before the SLR parent/child upgrade...\n'
npx supabase db reset --local --version "$PREVIOUS_VERSION" --no-seed

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "Could not locate the local Supabase Postgres container."
  exit 1
fi

echo "Using local database container: $DB_CONTAINER"

printf '\n[3/6] Loading controlled legacy SLR fixtures...\n'
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
set session_replication_role = replica;

insert into public.projects (
  id, owner_id, legacy_id, name, client_name, status, revision
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'legacy-safety-project',
  'SLR Migration Fixture',
  'Test Client',
  'Bidding',
  'Rev 0'
);

insert into public.slr_entries (
  id, owner_id, project_id, legacy_uid, sequence_number, display_number,
  system_name, scope_item, systems, scope_concern,
  rfi_question, rfi_number, include_formal_rfi,
  recommended_bid_basis, recommended_bid_basis_by_system,
  checklist_scope_item, checklist_scope_items_by_system,
  contractor_response, contractor_response_reason
) values
(
  '70000000-0000-0000-0000-000000000007',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'legacy-safety-001',
  7,
  'SLR-007',
  'Structured Cabling',
  'Released legacy scope',
  '["Structured Cabling"]'::jsonb,
  'Released concern',
  'Confirm cable category.',
  'RFI-004',
  true,
  'Provide Category 6A cabling.',
  '{"Structured Cabling":"Provide Category 6A cabling."}'::jsonb,
  'Confirm Category 6A is included.',
  '{"Structured Cabling":"Confirm Category 6A is included."}'::jsonb,
  'Included',
  ''
),
(
  '80000000-0000-0000-0000-000000000008',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '',
  8,
  'SLR-008',
  'Access Control',
  'Blank-ID false-positive guard',
  '["Access Control"]'::jsonb,
  'Must not inherit another release through a blank UID.',
  'Confirm access control scope.',
  'RFI-005',
  true,
  'Carry complete access control scope.',
  '{"Access Control":"Carry complete access control scope."}'::jsonb,
  'Confirm complete access control scope.',
  '{"Access Control":"Confirm complete access control scope."}'::jsonb,
  'Included',
  ''
),
(
  '90000000-0000-0000-0000-000000000009',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'legacy-safety-003',
  9,
  'SLR-009',
  'CCTV',
  'Unreleased legacy scope',
  '["CCTV"]'::jsonb,
  'This fixture has never appeared in an official release.',
  'Confirm CCTV scope.',
  'RFI-006',
  true,
  'Carry complete CCTV scope.',
  '{"CCTV":"Carry complete CCTV scope."}'::jsonb,
  'Confirm complete CCTV scope.',
  '{"CCTV":"Confirm complete CCTV scope."}'::jsonb,
  'Included',
  ''
);

insert into public.release_packages (
  id, owner_id, project_id, revision, status, filename, storage_path,
  release_number, lifecycle_status, snapshot_data, content_sha256,
  document_key, document_type, released_at
) values
(
  '33333333-3333-3333-3333-333333333331',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Rev 0',
  'Official Release',
  'fixture-release.pdf',
  'fixture/release.pdf',
  1,
  'Current',
  '{"issues":[{"uid":"legacy-safety-001","id":"SLR-007"},{"uid":"","id":"NOT-SLR-008"}],"deliverables":["sow","clarifications","rfi","checklist"]}'::jsonb,
  'fixture-sha-1',
  'project-package',
  'project-package',
  '2026-08-20T12:00:00Z'
),
(
  '33333333-3333-3333-3333-333333333332',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Rev 0',
  'Official Release',
  'fixture-malformed-snapshot.pdf',
  'fixture/malformed.pdf',
  2,
  'Superseded',
  '{"issues":{},"deliverables":"rfi"}'::jsonb,
  'fixture-sha-2',
  'malformed-fixture',
  'project-package',
  '2026-08-21T12:00:00Z'
);

insert into public.release_deliverables (
  owner_id, release_package_id, deliverable_type, sort_order
) values
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'sow', 0),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'clarifications', 1),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'rfi', 2),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'checklist', 3);

set session_replication_role = origin;
SQL

printf '\n[4/6] Applying only the pending SLR migration locally...\n'
npx supabase migration up --local

printf '\n[5/6] Verifying legacy locks, false-positive protection, and schema-health gating...\n'
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  released public.slr_entries%rowtype;
  blank_guard public.slr_entries%rowtype;
  unreleased public.slr_entries%rowtype;
  health jsonb;
begin
  select * into released from public.slr_entries where display_number = 'SLR-007';
  select * into blank_guard from public.slr_entries where display_number = 'SLR-008';
  select * into unreleased from public.slr_entries where display_number = 'SLR-009';

  if not released.number_locked or released.number_released_at is null then
    raise exception 'FAIL: released parent SLR number was not locked';
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

  health := public.scopelogic_schema_health();
  if health ->> 'version' <> '1.0-RC5.5' then
    raise exception 'FAIL: schema health version changed unexpectedly: %', health ->> 'version';
  end if;

  if (health -> 'missing') ? 'slr_entries.rfi_children'
     or (health -> 'missing') ? 'slr_entries.recommend_base_bid_children'
     or (health -> 'missing') ? 'slr_entries.contractor_checklist_children'
     or (health -> 'missing') ? 'slr_entries.number_locked'
     or (health -> 'missing') ? 'slr_entries.number_released_at'
     or (health -> 'missing') ? 'slr_entries.rbb_scope_letter_map' then
    raise exception 'FAIL: schema health does not recognize all SLR parent/child columns: %', health -> 'missing';
  end if;

  raise notice 'PASS: legacy release locks, false-positive guard, unlocked legacy content, malformed snapshot handling, and schema-health gating are correct.';
end $$;
SQL

printf '\n[6/6] Replaying the entire migration chain from scratch...\n'
npx supabase db reset --local --no-seed

printf '\nSLR LOCAL MIGRATION VALIDATION PASSED. Production was not contacted or modified.\n'
