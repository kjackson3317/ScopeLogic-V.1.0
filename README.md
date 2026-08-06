# ScopeLogic v1.0 RC4

RC4 is the product-simplification and final-workflow release. It retains the verified RC3.1 Supabase database and private document-storage architecture while reducing nonessential features and improving the production workflow.

## RC4 changes

- One SLR may apply to multiple systems.
- Each selected system receives a separate Recommended Bid Basis.
- Recommended SOW rows are expanded and grouped by system.
- The editable Contractor Response Checklist remains one PDF and is divided into system sections.
- The Formal RFI PDF contains only the RFI number, affected systems, and question; answers remain internal.
- The Internal Matrix uses a full-width entry form with the submitted-SLR list below it.
- `Reason / Basis` and the internal `Contractor Response` fields are removed from the active interface.
- `Contract Reference / Scope-Gap Basis` is renamed `Document Reference`.
- Cloud documents can be renamed and fallback uploads can be retried from Project Documents.
- Contract Information is reorganized for ScopeLogic consulting engagements.
- Dashboard cards wrap long values and use available space more effectively.
- Project Setup is above Dashboard and the Internal Matrix is under Project.
- Bid Leveling Summary is removed because it had no production data source.
- Integrated email delivery and Resend configuration are removed.
- Production Setup is replaced by read-only System Status and Retry Cloud Sync.

## Required Vercel variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

## Required migration

```text
supabase/migrations/20260806000100_scopelogic_rc4_product_simplification.sql
```

Use `PRODUCTION-DEPLOYMENT.md` for the browser-only Codespaces deployment sequence.
