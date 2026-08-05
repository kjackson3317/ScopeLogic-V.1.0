# ScopeLogic v1.0 RC3.1 — Cloud Stabilization

## Schema repair

- Adds the missing `projects.customer_id` column when required.
- Recreates the customer relationship, index, ownership helper, and RLS policy.
- Reconciles RC3 cloud-cutover columns in `user_settings` and `project_documents`.
- Reconciles uniqueness indexes required by Supabase upserts.
- Reasserts the private `project-files` bucket and storage policies.

## Diagnostics

- Adds authenticated RPC `scopelogic_schema_health()`.
- Validates required tables, columns, and the private storage bucket before cloud access.
- Reports the exact missing database object instead of only displaying a generic connection error.
- Displays the verified schema version and last successful cloud save.

## Data protection

- Cloud saves now perform a schema preflight before modifying records.
- Retry Cloud Sync first validates and reads the cloud workspace.
- Pending browser changes are saved only after schema validation.
- A blank fallback workspace is not blindly written over existing cloud data.
- Local Storage and IndexedDB remain intact throughout verification.

## Migration

```text
supabase/migrations/20260805000100_scopelogic_rc31_schema_repair.sql
```
