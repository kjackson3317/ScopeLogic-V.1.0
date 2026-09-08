# ScopeLogic Client CRM Preview

Branch: `feature/crm-mvp-preview`
Base: `rc5.7-multi-user`

## Purpose

ScopeLogic does not need a bid/opportunity forecasting CRM. The CRM should function as a client-relationship, communication-history, project-history, and receivables workspace.

Primary questions it should answer:

1. Who have we communicated with, and when?
2. Who needs a follow-up now or later?
3. What prior projects have we completed for this client?
4. What active projects are underway?
5. What have we invoiced, what has been paid, and what remains due?
6. How much has each client paid historically and year-to-date?

## Safety boundary

This branch is intentionally non-production.

- No production deployment should be promoted from this branch.
- The CRM preview route stores data only in browser localStorage under `scopelogic-crm-preview-v2`.
- The existing ScopeLogic customer/contact/project database is not read or written by the CRM preview.
- `PROPOSED_ONLY_20260907000200_scopelogic_crm_mvp.sql` is a design draft only and must not be applied to Supabase.
- No CRM GRANT statements or PostgREST schema reload are included in the draft migration.

## Preview route

`/crm-preview`

The route requires the same authenticated ScopeLogic session as the main application.

## CRM MVP included

- Relationship Dashboard
- Clients & Contacts
- Relationship statuses:
  - Prospect
  - Active Client
  - Past Client
  - Dormant
- Communication Audit Trail
  - Email
  - Call
  - Teams
  - Meeting
  - Text
  - Document
  - Internal Note
- Incoming / Outgoing / Internal communication direction
- Client follow-up tasks
- Project history
- Existing/active project list
- Actual authorized project fees
- Invoice records
- Payment records
- Outstanding balances / A/R
- Payments received YTD
- All-time payments received
- Per-client lifetime project fees, payments, and outstanding balances
- JSON export of preview data
- Browser-local demo reset

## Deliberately excluded

- Opportunity pipeline
- Probability of close
- Expected close date
- Weighted pipeline
- Forecast sales value
- Bid/job scouting
- Estimated opportunity revenue

## Intended production integration after acceptance

1. Continue using existing `customers`, `contacts`, and `projects` as the source of truth.
2. Add relationship status/notes to customers.
3. Add `crm_communications` for the audit trail.
4. Add `crm_follow_ups` for reminders and relationship check-ins.
5. Add `crm_invoices` and `crm_payments` for a lightweight receivables ledger tied to existing projects.
6. Let project/client screens summarize historical fees, invoiced amounts, payments received, and balances due.
7. Add optional Gmail logging only after the manual workflow is accepted.
8. Keep accounting lightweight; this is not intended to replace bookkeeping software.

## Suggested future integrations

- Gmail: log sent/received messages against client/contact/project records.
- Calendar: log client meetings and optionally create follow-up tasks.
- ScopeLogic Contract Information: feed authorized project fee and contract details into CRM project history.
- Invoice/payment import or accounting integration later if transaction volume warrants it.
