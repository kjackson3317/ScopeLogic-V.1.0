# ScopeLogic v1.0 RC5.5 — Estimating UX, Proposal & Matrix References

RC5.5 builds on the tested RC5.4 integrated PDF Drawing Take Off and estimating workflow. It focuses on faster catalog work, safer quote/template editing, reusable Take Off rules, a more conventional customer proposal, and clearer Internal Matrix references.

## Parts Database and Add Parts
- Manufacturer, Part Number, and Description are independent filters that work together using AND logic.
- Partial part-number matching supports product-family searches such as a manufacturer plus a common part-number prefix.
- The Parts Database opens with no catalog rows rendered until a search is entered. New manually-created rows remain visible until saved.
- Parts results sort by Manufacturer A–Z, then Part Number A–Z.
- Save Parts Database moved to the top action bar.
- The same three-filter part search is used for Add Parts, Quote Templates, and Take Off rule outputs.
- Existing full XLSX export/import, alphabetical export, pricing-only updates, and duplicate Part Number protection remain intact.

## Quote BOM
- Description receives more table width while Qty, Cost, and labor-minute inputs are compact.
- Quote lines may intentionally remain at Qty 0.
- BOM rows can be multi-selected, selected all at once, and deleted in one action.
- Header ordering supports drag/drop plus explicit up/down controls; proposal header order follows quote order.

## Take Off Rules
- Rule Builder uses Manufacturer + partial Part Number + Description filtering before showing database parts.
- Existing rules can be duplicated as a new rule, including THEN parts, labor, capacity, cable, and calculation settings.
- Access Control and CCTV receive practical IF Scenario labels without hard-coding materials or automatically enabling rules.
- Access scenarios include common door configurations, device-only conditions, panel capacity, and power-supply capacity.
- CCTV scenarios include common camera types, licenses, mounting, PoE/switch-port capacity, recorder-channel capacity, and camera cable runs.
- Existing user-controlled IF/THEN calculations, pooled cable demand, capacity rounding, and Drawing Take Off quantities remain intact.

## Quote Templates
- Opening Quote Templates starts on a new draft instead of automatically opening an existing saved template.
- Existing templates enter edit mode only after deliberate selection.
- Qty 0 is supported in templates.

## Customer Proposal PDF
- Reworked into a more conventional estimate/proposal layout while retaining ScopeLogic branding.
- Customer/project and quote information use ruled, aligned fields.
- Single Scope of Work section continues across pages without clipping.
- Full BOM remains customer-safe: Description + Qty only.
- Job-specific BOM headers appear in the proposal when the quote uses them; otherwise the BOM is flat.
- Pricing summary remains Material Total, Labor Total, Tax, and Total Price only.
- Approved-only PDF generation and Full BOM / No BOM modes remain unchanged.

## Internal Matrix Reference Standard
- Contract-document citation is labeled **Source Reference** instead of the ambiguous Document Reference.
- Added **Source Type** for Drawing, Specification, Addendum, RFI/ASI, Existing Condition, Owner Direction, Scope Omission, Minimum System Requirement, or Other.
- **SLR ID** remains the permanent ScopeLogic cross-reference and **Markup Reference**.
- Snippet ID, Source Reference, Source Type, SLR ID, and Markup Reference are shown together in the matrix editor.
- Drawing-created SLRs automatically use Source Type = Drawing.

## Mobile / Responsive
- New search panels, bulk BOM controls, header reorder controls, rule search, and matrix reference fields collapse for narrow screens while existing Drawing Take Off/mobile behavior is preserved.

## Database Migration Required
RC5.5 adds `slr_entries.source_type` and advances the schema health marker to `1.0-RC5.5`.

Apply:

`supabase/migrations/20260810000100_scopelogic_rc55_matrix_source_reference.sql`

before using RC5.5 against the cloud database.
