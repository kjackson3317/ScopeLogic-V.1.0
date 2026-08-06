# ScopeLogic v1.0 RC4.1

RC4.1 is a focused refinement to the verified RC4 release. It preserves the RC3.1/RC4 Supabase and private-storage architecture while correcting how multi-system SLRs are presented in the matrices and how contractor-checklist scope is entered.

## RC4.1 changes

- A multi-system SLR appears only once in the Recommended SOW Matrix.
- The SLR row lists all affected systems.
- The Recommended Bid Basis cell contains a separate labeled section for every selected system.
- The Clarification Matrix continues to show one SLR row with all systems and system-specific recommendations inside the same cell.
- Every selected system has its own Contractor Checklist Scope Item field in the Internal Matrix.
- A blank system-specific checklist field excludes the SLR from that system section of the checklist.
- The Contractor Response Checklist remains one editable PDF divided into system sections.
- Existing RC4 shared checklist text is copied into every selected system during migration so prior scope is preserved.
- All other RC4 workflow, contract, document-renaming, navigation, dashboard, email-removal, and Formal RFI behavior remains unchanged.

## Required Vercel variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

## Required migration

```text
supabase/migrations/20260806000200_scopelogic_rc41_matrix_checklist_refinement.sql
```

Use `PRODUCTION-DEPLOYMENT.md` for the browser-only Codespaces deployment sequence.
