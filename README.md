# ScopeLogic v1.0

ScopeLogic v1.0 is the production closeout release of the browser-based Division 27/28 scope consulting workspace.

## Production capabilities

- Supabase authentication, row-level security, and cloud database source of truth
- Private cloud storage for project documents and official release PDFs
- Multi-system SLR records with one-row matrix presentation
- Per-system Recommended Bid Basis and Contractor Checklist Scope Item fields
- Editable Contractor Response Checklist PDF
- Formal RFI PDF without an external Answer field
- Numbered Official Releases (`Release 001`, `Release 002`, and so on)
- Immutable official-release metadata, captured project snapshot, and SHA-256 content hash
- Current and Superseded release status
- Project backup ZIP export including cloud document bytes
- Controlled restore as a new project
- Final production System Status screen

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

`NEXT_PUBLIC_SITE_URL` must be the final HTTPS custom domain.

## Required Supabase migration

Apply all migrations through:

```text
supabase/migrations/20260806000300_scopelogic_v1_production_closeout.sql
```

The final System Status schema version is `1.0`.

## Verification

```bash
node scripts/verify-clean-source.mjs
npm install
npm run build
```

After deployment and migration, complete `V1.0-ACCEPTANCE-CHECKLIST.md` before tagging `v1.0.0`.
