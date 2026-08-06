# ScopeLogic v1.0 RC4.1 — Browser-Only Deployment

This release is deployed through GitHub Codespaces, Vercel, Supabase, and the ScopeLogic production website. No GitHub Desktop or local software is required.

## Before starting

- Confirm RC4 is Cloud synced.
- Keep the rollback tag `v1.0-rc3.1-verified`.
- Create a rollback tag for the working RC4 commit: `v1.0-rc4-before-matrix-refinement`.
- Do not clear the original browser recovery copy.

## 1 — Install RC4.1 in Codespaces

Upload `ScopeLogic-v1.0-RC4.1-Matrix-Checklist-Refinement.zip` to the repository root, extract it to `/tmp/scopelogic-rc41`, verify it, then replace the repository while preserving `.git`.

```bash
rm -rf /tmp/scopelogic-rc41
mkdir -p /tmp/scopelogic-rc41
unzip -q "ScopeLogic-v1.0-RC4.1-Matrix-Checklist-Refinement.zip" -d /tmp/scopelogic-rc41
ls -la /tmp/scopelogic-rc41
ls -1 /tmp/scopelogic-rc41/supabase/migrations
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a /tmp/scopelogic-rc41/. .
node scripts/verify-clean-source.mjs
npm install
npm run build
```

Commit and push:

```bash
git add -A
git commit -m "Install ScopeLogic v1.0 RC4.1"
git push origin main
```

## 2 — Confirm Vercel

Wait for the deployment associated with `Install ScopeLogic v1.0 RC4.1` to show **Ready**. Confirm the three required Production variables remain visible.

Do not use the updated ScopeLogic application until the RC4.1 migration is applied. RC4.1 refuses cloud writes against the RC4 schema.

## 3 — Apply the RC4.1 migration

Relink the repository if the clean replacement removed `supabase/.temp`.

```bash
npx supabase@latest link --project-ref YOUR_PROJECT_REFERENCE
npx supabase@latest migration list
npx supabase@latest db push --dry-run
```

Only this migration should be pending:

```text
20260806000200_scopelogic_rc41_matrix_checklist_refinement.sql
```

Apply it:

```bash
npx supabase@latest db push
```

## 4 — Verify ScopeLogic

1. Open the permanent production URL in the original browser.
2. Press `Ctrl+F5`.
3. Open **Administration → System Status**.
4. Select **Retry Cloud Sync**.
5. Confirm `Cloud synced` and schema version `RC4.1`.
6. Complete `RC4.1-ACCEPTANCE-CHECKLIST.md`.
