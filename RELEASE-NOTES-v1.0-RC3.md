# ScopeLogic v1.0 RC3 — Cloud Storage and Database Cutover

## Production data

- The application now loads the authenticated user's workspace from Supabase.
- Changes are saved to normalized production tables with a short debounce.
- A current browser snapshot remains in Local Storage as a recovery copy.
- A visible header badge reports Cloud synced, Saving to cloud, Cloud save error, or Local fallback.
- Production Setup provides a retry path when a cloud save fails.

## Project documents

- Existing IndexedDB file bytes can be migrated to the private `project-files` bucket.
- Storage paths follow the authenticated user folder required by the existing RLS policies.
- Project Documents uses short-lived signed URLs for private preview and download.
- New uploads and replacement revisions save to private cloud storage and the retained browser fallback.
- Files that are missing from IndexedDB are reported rather than silently marked migrated.
- Cloud migration completion is recorded in `user_settings` and `activity_log`.

## Official releases

- Downloaded official GC release packages are archived in private cloud storage.
- Release metadata and included deliverables are recorded in `release_packages` and `release_deliverables`.
- A cloud archival failure does not block the local PDF download.

## Database migration

RC3 adds:

- Selected project persistence
- Cloud data mode and revision tracking
- Last cloud-sync timestamp
- Cloud cutover completion timestamp
- Document storage migration timestamp
- Private bucket creation/verification

Migration file:

```text
supabase/migrations/20260729000100_scopelogic_rc3_cloud_cutover.sql
```

## Recovery policy

RC3 does not delete Local Storage or IndexedDB. Retire the browser fallback only after the second-browser acceptance test succeeds and a separate backup exists.
