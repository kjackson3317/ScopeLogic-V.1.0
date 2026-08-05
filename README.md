# ScopeLogic v1.0 RC3.1

RC3.1 is the cloud-stabilization release for the ScopeLogic production closeout. It repairs production schema drift, verifies the database before any cloud write, preserves the browser recovery copy, and provides clearer diagnostics for Supabase and private document storage.

## Primary corrections

- Repairs the missing `projects.customer_id` relationship and related RLS policy
- Reconciles all columns required by the RC3 cloud cutover
- Adds a `scopelogic_schema_health()` diagnostic RPC
- Verifies the RC3.1 schema before loading or saving the workspace
- Prevents Retry Cloud Sync from blindly overwriting cloud data
- Shows the verified schema version and last successful cloud save
- Preserves the private `project-files` bucket and authenticated storage policies
- Retains Local Storage and IndexedDB as recovery copies during verification

## Required Vercel variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

## Required migration

```text
supabase/migrations/20260805000100_scopelogic_rc31_schema_repair.sql
```

Use the browser-only Codespaces procedure in `PRODUCTION-DEPLOYMENT.md`. Do not clear browser data or start the document migration until ScopeLogic reports **Cloud synced**.
