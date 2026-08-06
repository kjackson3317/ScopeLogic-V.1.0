# ScopeLogic v1.0 RC4 — Browser-Only Deployment

This release is deployed through GitHub Codespaces, Vercel, Supabase, and the ScopeLogic production website. No GitHub Desktop or local development software is required.

## Before starting

- Confirm RC3.1 is cloud synced and passed the second-browser test.
- Keep the rollback tag `v1.0-rc3-before-closeout` in GitHub.
- Create and push a verified RC3.1 rollback tag before replacing the source: `v1.0-rc3.1-verified`.
- Do not clear the original browser recovery copy.
- Do not remove the three Supabase variables from Vercel.

## 1 — Install RC4 in Codespaces

1. Upload `ScopeLogic-v1.0-RC4-Product-Simplification-Final-Workflow.zip` to the repository root.
2. Confirm the ZIP name:

```bash
ls -1 *.zip
```

3. Extract it:

```bash
rm -rf /tmp/scopelogic-rc4
mkdir -p /tmp/scopelogic-rc4
unzip -q "ScopeLogic-v1.0-RC4-Product-Simplification-Final-Workflow.zip" -d /tmp/scopelogic-rc4
```

4. Verify the package:

```bash
ls -la /tmp/scopelogic-rc4
ls -1 /tmp/scopelogic-rc4/supabase/migrations
```

5. Replace the repository while preserving `.git`:

```bash
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a /tmp/scopelogic-rc4/. .
```

6. Verify and build:

```bash
node scripts/verify-clean-source.mjs
npm install
npm run build
```

7. Commit and push:

```bash
git add -A
git commit -m "Install ScopeLogic v1.0 RC4"
git push origin main
```

## 2 — Confirm Vercel

1. Open the ScopeLogic project in Vercel.
2. Open **Deployments**.
3. Open the deployment for `Install ScopeLogic v1.0 RC4`.
4. Wait for **Ready**.
5. Confirm these Production variables remain visible under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`

Do not open the new ScopeLogic application until the RC4 migration is applied. RC4 intentionally refuses cloud writes against the RC3.1 schema.

## 3 — Apply the RC4 migration

In the Codespaces terminal:

```bash
npx supabase@latest migration list
npx supabase@latest db push --dry-run
```

Only this migration should be pending:

```text
20260806000100_scopelogic_rc4_product_simplification.sql
```

Apply it:

```bash
npx supabase@latest db push
```

Wait approximately 30 seconds for the PostgREST schema cache to reload.

## 4 — Verify ScopeLogic

1. Open the permanent production URL in the original browser.
2. Press `Ctrl+F5`.
3. Sign in.
4. Open **Administration → System Status**.
5. Select **Retry Cloud Sync**.
6. Confirm:
   - Header says `Cloud synced`.
   - Database schema says `RC4`.
   - Private storage is available.
   - Existing projects and documents remain present.

## 5 — Run RC4 acceptance testing

Use `RC4-ACCEPTANCE-CHECKLIST.md`. Do not remove the browser recovery copy after RC4; final backup and recovery controls are part of the v1.0 release.
