# ScopeLogic v1.0 RC5.5.6

Released: August 12, 2026

## Breakout pricing

- Replaced the BOM-row **BOM** and **Breakout** dropdowns with fixed Base Bid, alternate, Breakout Pricing, and Purchasing BOM tabs.
- Added a quantity-allocation matrix that can split one BOM row across multiple named pricing breakouts, including partial quantities such as 2 units on First Floor and 8 units on Second Floor.
- Kept duplicate part-number rows independent so each occurrence can have its own quantity split.
- Added selected-row bulk percentage allocation, copy-first-pattern, and clear-allocation actions.
- Added live reconciliation status and an Unassigned Qty warning for every row that is not fully allocated.
- Added internal Base Bid and Base + Awarded Alternates breakout summaries with separate Material, Labor, Other/Fees, and Total columns.
- Customer proposals continue to show Base Bid breakouts separately from signed alternates. Proposal visibility settings and Total Price Only mode remain available.

## Alternates and purchasing

- Base Bid and every alternate remain separate BOM workspaces. Positive and negative alternate quantities continue to determine Add, Deduct, or No Cost automatically.
- Awarded alternates are included in the final Purchasing BOM and the internal awarded breakout summary.
- Awarding an unresolved alternate directs the estimator to its breakout allocation view when named breakouts exist.

## Compatibility and data safety

- Existing one-breakout-per-row assignments migrate in place to full-quantity allocations when loaded.
- Quote copies remap breakout allocations to the copied breakout IDs. Reusable quote templates intentionally omit project-specific breakout allocations.
- No Supabase schema migration is required; breakout allocations are stored inside the existing quote workspace document.
- Explicit Save and Delete controls, destructive confirmations, automatic quote numbering, revisions/change orders, responsive layout, alphanumeric sorting, collapsible navigation, multi-source Source Type, and proposal BOM selection remain unchanged.
