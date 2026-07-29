# ScopeLogic v1.0 RC2.4 — Dynamic Authentication Build Fix

## Corrected

- Prevented the protected root page from being statically prerendered during `next build`.
- Added an explicit dynamic-route declaration for the authenticated workspace.
- Added a safe Supabase configuration check before the server client is created.
- Added a readable production configuration screen when the active Vercel environment is missing either required Supabase variable.
- Preserved the complete RC2.3 application, PDF fixes, authentication foundation, database migration, and local-data import workflow.

## Required Vercel variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Variables must be assigned to the environment being deployed. After changing them, redeploy the project.
