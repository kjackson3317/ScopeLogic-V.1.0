# ScopeLogic v1.0 RC5.5

ScopeLogic RC5.5 is the current integrated estimating release candidate. It preserves the RC5.4 PDF Drawing Take Off → Take Off Rules → BOM → Quote workflow and improves catalog search, quote editing, rule reuse, customer proposals, and Internal Matrix references.

## Current estimating capabilities

- PDF Drawing Take Off with counts, measurements, calibration, markups, snippets/SLRs, and linked estimating-rule quantities
- Parts Database with XLSX import, pricing-only updates, full catalog export, unique Part Number enforcement, and Manufacturer/Part Number/Description AND filtering
- Parts Database stays unrendered until a search is entered and sorts Manufacturer A–Z / Part Number A–Z
- Quote Builder with source-aware Manual/Template/Take Off quantities, intentional Qty 0 lines, multi-select delete, compact numeric inputs, and wide descriptions
- Job-specific BOM headers with drag/drop and explicit header up/down reordering
- Quote Templates open on a new draft by default so saved templates are edited only after deliberate selection
- Take Off rule duplication, Access Control/CCTV IF Scenario labels, part-database multi-filter search, capacity calculations, and cable-package calculations
- No preloaded Take Off rules; estimators create and activate their own rule library
- Unified rich-text Scope of Work
- Approved-only customer proposal PDF with Full BOM or No BOM presentation; customer BOM uses Description + Qty and preserves quote headers
- Internal Matrix uses permanent SLR ID / Markup Reference plus Source Type and Source Reference for contract citations
- Responsive/mobile behavior preserved for estimating, Drawing Take Off, catalog, rules, BOM, and Scope of Work

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

## Supabase migrations

RC5.5 requires all prior migrations plus:

```text
supabase/migrations/20260810000100_scopelogic_rc55_matrix_source_reference.sql
```

Apply migrations before starting RC5.5 against the cloud workspace.

## Verification

```bash
npm install
npm run verify-source
npm run build
```

Complete local and Vercel Preview acceptance testing before promoting the tested deployment to Production.
