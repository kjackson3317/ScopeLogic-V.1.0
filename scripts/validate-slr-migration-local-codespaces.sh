#!/usr/bin/env bash
set -euo pipefail

TMP_SCRIPT="$(mktemp)"
cleanup() {
  rm -f "$TMP_SCRIPT"
}
trap cleanup EXIT

python3 - "$TMP_SCRIPT" <<'PY'
from pathlib import Path
import sys

target = Path(sys.argv[1])
source = Path('scripts/validate-slr-migration-postgres.sh').read_text()

source = source.replace(
    'docker exec "$CONTAINER" pg_isready -U postgres -d postgres',
    'docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d postgres',
)
source = source.replace(
    'docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1',
    'docker exec -e PGPASSWORD=postgres -i "$CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1',
)
source = source.replace(
    'echo "PostgreSQL is ready. No Supabase project is linked or contacted."',
    '''# The official postgres image briefly exposes a temporary bootstrap server before\n# starting the final server. Wait for the final TCP listener so the fixture load cannot\n# land in the restart gap.\nsleep 3\nstable=false\nfor _ in $(seq 1 20); do\n  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then\n    stable=true\n    break\n  fi\n  sleep 1\ndone\nif [[ "$stable" != true ]]; then\n  echo "PostgreSQL did not remain available after bootstrap."\n  docker logs "$CONTAINER" --tail 150 || true\n  exit 1\nfi\necho "PostgreSQL is ready. No Supabase project is linked or contacted."''',
)

target.write_text(source)
PY

chmod +x "$TMP_SCRIPT"

echo "Codespaces local validation: bypassing the Supabase base-image bootstrap."
echo "The Supabase Postgres image runs internal Realtime bootstrap migrations even when Realtime is excluded, and that bootstrap is exhausting the Codespaces DB connection queue."
echo "This validator uses a clean PostgreSQL 17 container, recreates the exact pre-upgrade tables touched by the SLR migration, applies the real migration twice, and verifies history locks and idempotence."
echo "The wrapper also waits through the official Postgres bootstrap restart and uses TCP rather than the transient Unix socket."
echo "No Supabase project is linked or contacted."

bash "$TMP_SCRIPT"
