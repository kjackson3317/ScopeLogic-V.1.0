# ScopeLogic v1.0 RC5.5.2 - Data Protection & Restore Center

## Data-loss protection

- New full-workspace restore points stored in Supabase with user-scoped RLS.
- Automatic checkpoints are created at most once every 15 minutes while changes are saved.
- Retention is bounded to 12 automatic checkpoints and 10 manual/recovery checkpoints per user.
- Manual restore points and one-click restoration are available in System Status.
- Every restoration creates a pre-restore checkpoint first.

## Safer synchronization

- A stale browser fallback can no longer overwrite an existing cloud workspace automatically.
- Pending browser fallback data is quarantined as a recovery checkpoint when possible, then the cloud source of truth is loaded.
- Cloud revision conflicts stop the save and require a reload instead of silently overwriting a newer revision.

## Complete portable backups

- System Status can download and import a full-workspace JSON backup.
- Full-workspace backups include projects, SLR records, document metadata, notes, customers, parts, quotes, templates, labor and pricing, takeoff data, drawing annotations, Scope of Work, and workspace settings.
- Existing project ZIP backup/restore remains available for project-level records and uploaded document files.

## Database migration

Apply:

`20260811000100_scopelogic_rc552_data_protection.sql`

before deploying the RC5.5.2 application.
