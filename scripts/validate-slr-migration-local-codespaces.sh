#!/usr/bin/env bash
set -euo pipefail

CONFIG="supabase/config.toml"
BACKUP="$(mktemp)"
cp "$CONFIG" "$BACKUP"

cleanup() {
  cp "$BACKUP" "$CONFIG" 2>/dev/null || true
  rm -f "$BACKUP"
  npx supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

python3 <<'PY'
from pathlib import Path
path = Path('supabase/config.toml')
text = path.read_text()
header = '[realtime]'
if header not in text:
    if not text.endswith('\n'):
        text += '\n'
    text += '\n[realtime]\nenabled = false\n'
else:
    lines = text.splitlines()
    out = []
    in_section = False
    found_enabled = False
    inserted = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('[') and stripped.endswith(']'):
            if in_section and not found_enabled:
                out.append('enabled = false')
                inserted = True
            in_section = stripped == header
            found_enabled = False if in_section else found_enabled
            out.append(line)
            continue
        if in_section and stripped.startswith('enabled'):
            out.append('enabled = false')
            found_enabled = True
        else:
            out.append(line)
    if in_section and not found_enabled:
        out.append('enabled = false')
    text = '\n'.join(out) + '\n'
path.write_text(text)
PY

export DO_NOT_TRACK=1

echo "Codespaces local validation: Realtime is temporarily disabled because its bootstrap migration exhausted the local DB connection queue."
echo "The original supabase/config.toml will be restored automatically on exit."

npx supabase stop --no-backup >/dev/null 2>&1 || true
bash scripts/validate-slr-migration-local.sh
