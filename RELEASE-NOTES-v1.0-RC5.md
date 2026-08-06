# ScopeLogic v1.0 RC5 — Mobile and AI Drafting

## Mobile corrections

- Added a slide-in navigation drawer for tablet and phone widths.
- Added a persistent Close control, shaded outside-tap target, Escape handling, and focus containment.
- Browser Back closes the open menu before leaving the current application state.
- Selecting a navigation item or switching projects automatically closes the menu.
- Added a compact mobile header with project identity, cloud status, and an Actions menu.
- Improved touch targets, mobile forms, submitted-SLR cards, dialogs, document screens, PDF previews, and sticky SLR submission controls.

## AI Draft Assistant

- Added an authenticated server-side OpenAI Responses API route.
- Added strict structured output for Scope Item, Scope Concern, Formal RFI Question, per-system Recommended Bid Basis, and per-system Contractor Checklist Scope Item.
- Document Reference is supplied by the user and is never generated or altered by AI.
- Existing populated fields are not selected for replacement by default.
- Each proposed field can be reviewed and applied independently.
- Applying AI text does not submit the SLR.
- Additional-system suggestions are informational and are never added automatically.
- Added administrator-only rate limiting, request-size limits, timeout handling, same-origin checks, and server-only key use.
- OpenAI request storage is disabled with `store: false`.
- Added internal AI provenance to submitted SLR data; provenance does not appear in client PDFs.
- Added `SCOPELOGIC_AI_ENABLED` to keep AI disabled until acceptance is complete.

## Database

New migration:

```text
20260806000400_scopelogic_rc5_mobile_ai.sql
```

It adds `slr_entries.ai_assistance` and advances schema health to `1.0-RC5`.
