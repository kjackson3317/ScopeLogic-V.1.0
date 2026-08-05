# ScopeLogic v1.0 RC3.1 — Browser-Only Production Deployment

This procedure uses GitHub Codespaces, Vercel, Supabase, and the ScopeLogic production website. No GitHub Desktop, PowerShell, or local software installation is required.

## Before starting

- Keep the original browser profile containing the ScopeLogic Local Storage and IndexedDB files.
- Do not clear browser history, cookies, Local Storage, site data, or IndexedDB.
- Confirm the rollback tag `v1.0-rc3-before-closeout` exists in GitHub.
- Keep the current production website open in a separate tab.

## Part 1 — Upload and install RC3.1 in Codespaces

1. Download `ScopeLogic-v1.0-RC3.1-Cloud-Stabilization.zip`.
2. Open the existing ScopeLogic Codespace.
3. Upload the ZIP to the repository root through the Explorer panel.
4. In the Codespaces terminal, confirm the ZIP name:

```bash
ls -1 *.zip
```

5. Extract the ZIP to a temporary folder:

```bash
rm -rf /tmp/scopelogic-rc31
mkdir -p /tmp/scopelogic-rc31
unzip -q "ScopeLogic-v1.0-RC3.1-Cloud-Stabilization.zip" -d /tmp/scopelogic-rc31
```

6. Confirm the extracted package contains `app`, `lib`, `public`, `supabase`, and `package.json`:

```bash
ls -la /tmp/scopelogic-rc31
```

7. Delete the old source while preserving `.git`:

```bash
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
```

8. Copy RC3.1 into the repository:

```bash
cp -a /tmp/scopelogic-rc31/. .
```

9. Verify the source package:

```bash
node scripts/verify-clean-source.mjs
```

Expected:

```text
ScopeLogic source verification passed
```

10. Install dependencies and run the production build:

```bash
npm install
npm run build
```

11. Commit and push:

```bash
git add -A
git commit -m "Install ScopeLogic v1.0 RC3.1"
git push origin main
```

## Part 2 — Confirm Vercel

1. Open Vercel and select the ScopeLogic project.
2. Open **Deployments**.
3. Open the deployment with commit message `Install ScopeLogic v1.0 RC3.1`.
4. Wait for **Ready**.
5. Under **Settings → Environment Variables**, confirm these are assigned to Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
6. If a variable is changed, redeploy before continuing.

## Part 3 — Apply the Supabase repair migration

In the Codespaces terminal:

```bash
npx supabase@latest login
```

Then link the same Supabase project referenced by `NEXT_PUBLIC_SUPABASE_URL`:

```bash
npx supabase@latest link --project-ref YOUR_PROJECT_REFERENCE
```

Review migration history:

```bash
npx supabase@latest migration list
```

Preview the pending migration:

```bash
npx supabase@latest db push --dry-run
```

The expected pending migration is:

```text
20260805000100_scopelogic_rc31_schema_repair.sql
```

Apply it:

```bash
npx supabase@latest db push
```

Wait 30 seconds after the migration completes.

## Part 4 — Restore cloud synchronization

1. Open the permanent production ScopeLogic URL in the original browser profile.
2. Press `Ctrl+F5`.
3. Sign in.
4. Open **Administration → Production Setup**.
5. Select **Retry Cloud Sync**.
6. Confirm:
   - Database foundation says `ScopeLogic RC3.1 production schema is verified.`
   - Live workspace is active.
   - The header says `Cloud synced`.
   - No missing database objects are listed.

## Part 5 — Verify a database edit

1. Open a real project.
2. Open **Internal Notes**.
3. Add `RC3.1 cloud synchronization test`.
4. Save and wait for `Cloud synced`.
5. Refresh with `Ctrl+F5`.
6. Confirm the note remains.

Do not migrate document files unless this test passes.

## Part 6 — Migrate browser files

1. Use the original browser profile containing the files.
2. Open **Administration → Production Setup**.
3. Confirm the `project-files` bucket is private in Supabase Storage.
4. Select **Migrate Browser Files to Cloud**.
5. Keep the tab open until complete.
6. Download the RC3.1 cutover report.
7. Resolve all required files marked Failed or Missing.

## Part 7 — Second-browser acceptance test

1. Open ScopeLogic in a different browser.
2. Sign in with the same administrator account.
3. Confirm projects, customers, SLRs, notes, contract data, calendar entries, and documents appear.
4. Open and download one current document and one previous revision.
5. Add `Second-browser cloud synchronization test` to Internal Notes.
6. Save, refresh, and confirm the note remains.
7. Refresh the original browser and confirm the same note appears.

Keep the browser recovery copy until all items in `RC3.1-ACCEPTANCE-CHECKLIST.md` pass.
