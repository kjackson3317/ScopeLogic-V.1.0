#!/usr/bin/env bash
set -euo pipefail

echo "Codespaces local validation: bypassing the Supabase base-image bootstrap."
echo "The Supabase Postgres image runs internal Realtime bootstrap migrations even when Realtime is excluded, and that bootstrap is exhausting the Codespaces DB connection queue."
echo "This validator uses a clean PostgreSQL 17 container, recreates the exact pre-upgrade tables touched by the SLR migration, applies the real migration twice, and verifies history locks and idempotence."
echo "No Supabase project is linked or contacted."

bash scripts/validate-slr-migration-postgres.sh
