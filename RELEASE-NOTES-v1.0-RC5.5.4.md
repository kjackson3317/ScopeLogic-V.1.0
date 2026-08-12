# ScopeLogic v1.0 RC5.5.4

Built on the RC5.5.3 / RC5.5.1 estimating baseline while preserving explicit saves and the RC5.5.2 cloud-conflict protections.

## Alternate pricing and purchasing BOM

- Replaced pre-classified Add and Deduct records with neutral named alternates. Each alternate is classified automatically as ADD, DEDUCT, or NO COST from its signed net value.
- Added Base Bid, named Alternate, and Purchasing BOM tabs.
- Alternate BOMs allow positive and negative quantities, duplicate part numbers, signed material and labor, and a combined signed alternate total.
- Added an optional short rich-text Scope of Work to every alternate.
- Base Bid pricing remains unchanged by alternates. Only awarded alternates reconcile into the read-only final Purchasing BOM.
- Unawarded alternate BOM rows remain hidden from the customer BOM while their scope and signed pricing remain visible as proposal options.

## Named pricing breakouts

- Added quote-specific breakout names, descriptions, proposal visibility, and display ordering.
- Base Bid rows can be assigned to any named breakout.
- Added a reconciled summary of Material, Labor, Other / Fees, and Total Price, including quote-level general conditions.
- Customer proposals can show the selected named breakout summaries without exposing internal line-item costs or markups.

## Quote numbering and lifecycle

- New quotes receive automatic globally scanned numbers in the format `SL-YYYY-#####-R##`.
- Added Duplicate Quote for creating an independent copy inside the current project with a new automatic root number.
- Added Copy Existing Quote for searching every project and creating an independent Draft copy in the current project, again with a new automatic root number.
- Added Save as Template from Quote Builder. The reusable template retains the Base Bid BOM, group headers, quantities, labor, and effective material markups while leaving alternates, private notes, pricing breakouts, awards, and project Scope of Work on the source quote.
- Revisions increment the `R##` suffix and lock the superseded predecessor.
- Awarded quotes can create change orders in the format `SL-YYYY-#####-CO##-R##`.
- Quote numbers are read-only in the quote editor to prevent accidental reuse.

## Pricing controls and editing

- Added optional per-line material markup overrides with a one-click return to the quote-wide global markup.
- Added independent markups for Other Taxable Items and Other Non-Taxable Job Costs.
- Added list indent / outdent controls, Tab / Shift+Tab sub-bullets, and 1.0 / 1.15 / 1.5 / 2.0 line spacing to the Scope of Work editor and alternate Scope of Work.
- Customer PDFs preserve the rich-text hierarchy and line spacing.
- Internal Notes and Admin Notes remain in their prior pricing-summary location and now divide the remaining vertical space evenly.
- Save and Delete controls remain explicit and are available at both the top and bottom of long quote and customer forms. Destructive confirmations are retained.

## Preserved behavior

- Responsive layouts, alphanumeric sorting, collapsible navigation, expanded quote workspace, BOM selection during PDF generation, multi-source Source Type, quote templates, Take Off calculations, and Parts Database workflows remain in place.
- Take Off recalculation is restricted to the Base Bid and preserves all alternate BOM rows unchanged.
- No autosave was introduced.

## Data and migration

No Supabase schema migration is required. The new quote metadata, breakouts, alternates, numbering fields, and markup overrides are stored inside the existing versioned workspace JSON. RC5.5.4 development and verification did not modify live Supabase data.

## Verification

- Clean-source verifier passed.
- TypeScript validation passed.
- Next.js production build completed successfully.
- Isolated browser checks covered automatic numbering, revisions, change orders, duplicate and signed alternate rows, awarded purchasing reconciliation, markup overrides, responsive layout, and equal-height note fields.
- Customer proposal PDF was rendered and reviewed across all pages for base pricing, breakouts, alternate scopes, signed totals, and continuation handling.
