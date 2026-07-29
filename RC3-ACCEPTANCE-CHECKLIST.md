# ScopeLogic v1.0 RC3 — Acceptance Checklist

## Deployment

- [ ] Clean RC3 source tree committed to `main`
- [ ] Vercel production build is Ready
- [ ] Build log contains `ScopeLogic source verification passed`
- [ ] Production URL redirects signed-out users to `/login`

## Database

- [ ] `20260729000100_scopelogic_rc3_cloud_cutover.sql` applied successfully
- [ ] Header reports Cloud synced
- [ ] A test record edit remains after refresh
- [ ] A test record edit appears from a second browser
- [ ] Local fallback remains present

## Document migration

- [ ] Production Setup count matches project document metadata
- [ ] Existing browser files migrated without unexplained failures
- [ ] Cutover report downloaded
- [ ] Current document previews from cloud
- [ ] Previous revision previews from cloud
- [ ] Cloud document downloads correctly
- [ ] New upload remains available after refresh
- [ ] Replacement revision preserves the previous file
- [ ] Deleting a test document removes the metadata and cloud object

## Existing workflows

- [ ] SLR create, edit, delete, and renumber work
- [ ] Global SLR template create and delete work
- [ ] Customer and contact changes persist
- [ ] Contract and project-contact changes persist
- [ ] Internal notes and calendar entries persist
- [ ] Individual PDFs generate
- [ ] Editable contractor checklist works
- [ ] Combined official GC release downloads
- [ ] Official release is archived in Supabase
- [ ] Authenticated email delivery works
- [ ] Export Log updates

## Cross-device verification

- [ ] Second browser loads the same projects and records
- [ ] Second browser opens a private project document
- [ ] Sign Out protects the workspace
- [ ] Original browser fallback has not been deleted
