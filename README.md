# ScopeLogic v1.0 RC5

ScopeLogic v1.0 RC5 is the final release candidate for the browser-based Division 27/28 scope consulting workspace. It preserves the verified RC4.1 matrix and PDF workflow, adds the v1.0 production-closeout controls, corrects the mobile experience, and introduces a controlled AI Draft Assistant.

## Production capabilities

- Supabase authentication, row-level security, and cloud database source of truth
- Private cloud storage for project documents and official release PDFs
- Multi-system SLR records with one-row matrix presentation
- Per-system Recommended Bid Basis and Contractor Checklist Scope Item fields
- Editable Contractor Response Checklist PDF
- Formal RFI PDF without an external Answer field
- Numbered, immutable Official Releases with captured snapshot and SHA-256 hash
- Project backup ZIP export and controlled restore as a new project
- Mobile navigation drawer with Close control, outside-tap close, automatic close after selection, and browser-Back handling
- Responsive Internal Matrix, dialogs, action controls, document screens, and SLR cards
- Authenticated OpenAI-powered SLR Draft Assistant with structured field output
- Field-by-field AI review; existing text is never overwritten by default
- No automatic SLR submission and no AI-generated document references
- Internal AI-assistance provenance that is excluded from client deliverables

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
OPENAI_API_KEY
SCOPELOGIC_AI_ENABLED
```

Optional:

```text
OPENAI_MODEL=gpt-5-mini
```

Keep `SCOPELOGIC_AI_ENABLED=false` in Production until the separate AI acceptance test is complete. The remainder of ScopeLogic operates normally while AI is disabled.

## Required Supabase migrations

Apply all migrations through:

```text
supabase/migrations/20260806000400_scopelogic_rc5_mobile_ai.sql
```

Because migration `20260806000300_scopelogic_v1_production_closeout.sql` has not yet been applied, the first RC5 production push should list both `20260806000300` and `20260806000400` in sequence.

The RC5 System Status schema version is `1.0-RC5`.

## Verification

```bash
node scripts/verify-clean-source.mjs
npm install
npm run build
```

Complete `RC5-ACCEPTANCE-CHECKLIST.md` before enabling AI in Production or tagging `v1.0.0`.
