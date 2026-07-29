# ScopeLogic v1.0 RC3 — Production Deployment

## Before starting

- Keep the original computer and browser profile that contain the existing ScopeLogic IndexedDB document files.
- Do not clear browser history, site data, Local Storage, cookies, or IndexedDB.
- Keep using the permanent Vercel production domain.
- Confirm the RC2 database import was previously verified.

## Part 1 — Replace the GitHub source tree

1. Extract the RC3 ZIP.
2. Open the `ScopeLogic-Rev14` repository through GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` folder and delete every other repository file and folder.
5. Copy every RC3 file and folder into the repository.
6. Commit with:

```text
Clean install ScopeLogic v1.0 RC3
```

7. Push to `main`.
8. Wait for Vercel to report **Ready**.

The build log should include:

```text
ScopeLogic source verification passed
```

## Part 2 — Apply the RC3 database migration

Open PowerShell in the clean repository folder and run:

```powershell
npx.cmd supabase@latest db push --dry-run
```

Confirm the pending migration is:

```text
20260729000100_scopelogic_rc3_cloud_cutover.sql
```

Then run:

```powershell
npx.cmd supabase@latest db push
```

Approve the migration. Existing RC2 migrations will be skipped because they are already recorded in Supabase migration history.

## Part 3 — Verify live cloud synchronization

1. Open the permanent ScopeLogic production URL in the original browser profile.
2. Sign in.
3. Confirm the top bar shows **Cloud synced**.
4. Open **Administration → Production Setup**.
5. Confirm:
   - Secure login is available.
   - Database foundation is available.
   - Live workspace reports Supabase reads and writes.
   - The browser recovery copy remains enabled.

When the page reports that RC3 columns are missing, confirm `db push` completed and refresh the browser.

## Part 4 — Migrate document files

Perform this only in the original browser profile containing the IndexedDB files.

1. Open **Administration → Production Setup**.
2. Review Total metadata records, Stored in Supabase, Pending browser files, and Need attention.
3. Select **Migrate Browser Files to Cloud**.
4. Keep the browser tab open until the process finishes.
5. Confirm the result says **Cloud cutover completed** or review any missing/failed files.
6. Download **ScopeLogic RC3 Cloud Cutover Report**.
7. Do not clear the browser fallback.

Files that cannot be found in IndexedDB remain identified as pending. Re-upload those documents through Project Documents, then rerun the migration verification.

## Part 5 — Verify project documents

For at least one current document and one previous revision:

1. Open or preview the file.
2. Download the file.
3. Confirm the Project Documents row shows **Cloud**.
4. Upload a new test document.
5. Confirm it opens after refreshing the page.
6. Delete the test document if it is not needed.

## Part 6 — Second-browser acceptance test

1. Open ScopeLogic from a different browser profile or computer.
2. Sign in using the administrator account.
3. Confirm customers, projects, contacts, SLRs, templates, notes, calendar entries, contract information, and export history load.
4. Open and download a cloud-stored project document.
5. Make a small test edit, save it, refresh, and confirm it remains.
6. Sign out and confirm the workspace is protected.

Keep the original browser fallback until all checks in `RC3-ACCEPTANCE-CHECKLIST.md` pass.
