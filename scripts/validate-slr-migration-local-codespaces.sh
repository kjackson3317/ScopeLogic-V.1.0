#!/usr/bin/env bash
set -euo pipefail

TMP_SCRIPT="$(mktemp)"

cleanup() {
  rm -f "$TMP_SCRIPT"
  npx supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

EXCLUDE_SERVICES="gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"

python3 - "$EXCLUDE_SERVICES" "$TMP_SCRIPT" <<'PY'
from pathlib import Path
import sys

exclude = sys.argv[1]
target = Path(sys.argv[2])
source = Path('scripts/validate-slr-migration-local.sh').read_text()
old = "npx supabase start >/tmp/scopelogic-supabase-start.log 2>&1 || {"
new = f'npx supabase start -x "{exclude}" --debug >/tmp/scopelogic-supabase-start.log 2>&1 || {{'
if old not in source:
    raise SystemExit('Could not find the local Supabase start command in the validation script.')
target.write_text(source.replace(old, new, 1))
PY

chmod +x "$TMP_SCRIPT"
export DO_NOT_TRACK=1

echo "Codespaces local validation: starting only the local Postgres container."
echo "Auth, Realtime, Storage API, Studio, and other service containers are excluded to stay within Codespaces resource limits."
echo "The database still receives the normal Supabase base schema and the repository migration chain."

npx supabase stop --no-backup >/dev/null 2>&1 || true
bash "$TMP_SCRIPT"
