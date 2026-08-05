# ScopeLogic v1.0 RC3.1 — Acceptance Checklist

## Source and deployment

- [ ] RC3 rollback tag exists
- [ ] Clean RC3.1 source committed to `main`
- [ ] Codespaces `npm run build` succeeds
- [ ] Vercel production deployment is Ready
- [ ] Vercel Production contains all three required Supabase/site variables

## Database stabilization

- [ ] `20260805000100_scopelogic_rc31_schema_repair.sql` applied
- [ ] Production Setup reports `ScopeLogic RC3.1 production schema is verified`
- [ ] No missing schema objects are listed
- [ ] Header reports Cloud synced
- [ ] Internal Notes test survives refresh
- [ ] Local browser recovery remains intact

## Document storage

- [ ] `project-files` bucket is private
- [ ] Browser document migration completes
- [ ] Cutover report downloaded
- [ ] Required files have no unresolved Failed or Missing status
- [ ] Current document opens from cloud
- [ ] Previous revision opens from cloud
- [ ] New upload remains available after refresh

## Second browser

- [ ] Customers and projects load
- [ ] SLRs, notes, contracts, and calendar entries load
- [ ] Private document opens and downloads
- [ ] Second-browser edit survives refresh
- [ ] Second-browser edit appears in original browser
- [ ] Sign Out protects the workspace
