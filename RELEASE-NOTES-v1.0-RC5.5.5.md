# ScopeLogic v1.0 RC5.5.5

RC5.5.5 builds on RC5.5.4 and adds customer proposal price-visibility choices.

## Customer proposal pricing display

- Added an explicit Customer Pricing Display choice before PDF generation.
- Detailed pricing preserves the Material, Labor, Other / Fees, Tax, Bond, and Total Price presentation.
- Total price only hides Material, Labor, Other / Fees, Tax, and Bond from the customer proposal.
- In Total price only mode, the Base Bid shows only its Total Price, named pricing breakouts show only their totals, and each alternate shows only its signed Alternate Total.
- The same pricing-display choice applies to proposals with a reconciled BOM and proposals without a BOM.
- Internal costs, markups, and private notes remain excluded in both modes.

## RC5.5.4 features included

- Neutral signed alternates, named pricing breakouts, awarded purchasing-BOM reconciliation, short alternate Scope of Work, rich Scope of Work indentation and spacing, automatic quote/revision/change-order numbers, per-line and other-cost markups, quote duplication, cross-project quote copying, and global quote templates.
- Responsive layout, alphanumeric sorting, collapsible navigation, explicit Save/Delete behavior, BOM selection during PDF generation, and multi-source Source Type remain intact.

## Data protection and migration

- A verified manual Supabase restore point and an offline full-workspace JSON backup were created before deployment work began.
- No Supabase schema migration is required. The proposal display choice is selected at PDF-generation time and does not rewrite existing quotes or workspace data.

## Verification

- Clean-source verification, TypeScript validation, production build, isolated browser testing, and visual PDF review are required before production deployment.
