# ScopeLogic v1.0 RC3

ScopeLogic v1.0 RC3 completes the first production data cutover. The Revision 14.8 consulting workflow remains intact, while the authenticated application now loads and saves live records through Supabase and stores project documents in the private `project-files` bucket.

## Included

- Supabase Auth login, logout, password reset, and protected routes
- Live Supabase reads and debounced writes for projects, customers, contacts, SLRs, templates, contracts, internal notes, calendar entries, document metadata, export history, and email settings
- Cloud synchronization status in the application header
- Automatic local browser recovery copy retained during RC3 verification
- One-time migration of existing IndexedDB project files to private Supabase Storage
- Cloud-first document preview and download with signed private URLs
- New document uploads saved to both Supabase Storage and the browser fallback
- Official GC release packages archived in private cloud storage when downloaded
- Row Level Security and authenticated storage policies
- Downloadable browser-import and cloud-cutover reports
- RC3 database migration under `supabase/migrations`

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Existing Resend variables remain required for email delivery.

## Required RC3 migration

After deploying this source tree, run:

```powershell
npx.cmd supabase@latest db push
```

The CLI should apply:

```text
20260729000100_scopelogic_rc3_cloud_cutover.sql
```

## Deployment order

Follow `PRODUCTION-DEPLOYMENT.md` exactly. Use the original browser profile for the document migration, and retain the local browser copy until the second-browser acceptance test passes.

See `RELEASE-NOTES-v1.0-RC3.md` and `RC3-ACCEPTANCE-CHECKLIST.md`.
