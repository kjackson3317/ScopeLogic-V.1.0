# ScopeLogic CRM MVP Preview

Branch: `feature/crm-mvp-preview`
Base: `rc5.7-multi-user`

## Safety boundary

This branch is intentionally non-production.

- No production deployment should be promoted from this branch.
- The CRM preview route stores data only in browser localStorage under `scopelogic-crm-preview-v1`.
- The existing ScopeLogic customer/contact database is not read or written by the CRM preview.
- `PROPOSED_ONLY_20260907000200_scopelogic_crm_mvp.sql` is a design draft only and must not be applied to Supabase.
- No CRM GRANT statements or PostgREST schema reload are included in the draft migration.

## Preview route

`/crm-preview`

The route requires the same authenticated ScopeLogic session as the main application.

## CRM MVP included

- Sales dashboard
- Companies and contacts
- Opportunity pipeline
- Pipeline stages:
  - Lead
  - Ready to Contact
  - Contacted
  - Responded
  - Qualified
  - Project Received
  - SOW Sent
  - Contract / Vendor Setup
  - Won
  - Lost / Dormant
- Service interest:
  - Quick Review
  - Large Project
  - Both
- Activity timeline
- Follow-up tasks
- Open and weighted pipeline values
- JSON export of preview data
- Browser-local demo reset

## Intended production integration after acceptance

1. Extend the current `customers` and `contacts` records rather than creating duplicate company/contact tables.
2. Add CRM opportunity, activity, and task tables with RC5.7 workspace-aware RLS.
3. Add a `Sales` navigation group to the main ScopeLogic workspace.
4. Allow an accepted opportunity to create/link a Master Project and Client Engagement without losing CRM history.
5. Allow the Project SOW workflow to use client/contact/opportunity data to prefill authorization documents.
6. Add email logging/integration only after the manual CRM workflow is stable.

## Acceptance questions

- Is the pipeline stage list right for the way ScopeLogic will sell?
- Should subordinate users see only assigned opportunities, or all company/contact records with only assigned opportunities restricted?
- Should Quick Review opportunities and large-project opportunities share one pipeline or have separate saved views?
- What information should be mandatory before moving from `Qualified` to `Project Received`?
- Should `Won` automatically prompt creation of a ScopeLogic Master Project / Client Engagement?
