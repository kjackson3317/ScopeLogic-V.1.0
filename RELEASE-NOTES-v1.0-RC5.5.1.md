# ScopeLogic v1.0 RC5.5.1 — Proposal Selection & Responsive Workspace

## Changes
- Full-BOM customer PDF now opens a second selection step where the estimator chooses exactly which quote items appear. Selection is grouped by the quote's BOM headers.
- Removed the internal Approved status label from customer-facing proposal PDFs. Approval is still required before generation.
- Data-driven dropdowns, multiselect lists, rule/template selectors, and filtered part results use alphanumeric ordering.
- Internal Matrix Source Type is now multi-select and supports Drawing + Specification + other simultaneous sources. Added Not Mentioned in Contract Documents. Existing `source_type` text storage remains compatible by saving selected values as a semicolon-delimited list.
- Quote Builder no longer dedicates a permanent side column to all project quotes. Quotes are selected from a compact Current Quote dropdown, freeing width for the BOM and pricing tools.
- Desktop navigation can be collapsed and restored from the top bar. Existing mobile navigation behavior is preserved.
- Added responsive width handling for narrower desktop windows and proposal/BOM dialogs.

## Database
No new Supabase migration is required. RC5.5.1 uses the RC5.5 schema and existing `source_type` text column.
