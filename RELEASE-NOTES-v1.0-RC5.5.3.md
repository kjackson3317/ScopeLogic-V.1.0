# ScopeLogic v1.0 RC5.5.3

Built on the RC5.5.2 data-protection baseline.

## Added

- Dedicated Add Alternate and Deduct Alternate records in Quote Builder.
- Clear BOM item assignment to Base BOM or a named alternate.
- Separate Material, Labor, and signed combined totals for every alternate.
- Base quote calculations exclude alternate items, preventing silent roll-in.
- Customer proposal/PDF sections for alternate BOM items and signed alternate pricing.
- Matching Save/Delete actions at the top and bottom of Quote Builder and Customer Database.

## Preserved

- Explicit save behavior; no autosave was introduced.
- Destructive confirmation for quote and customer removal.
- Responsive layouts, alphanumeric sorting, collapsible navigation, expanded quote workspace, BOM selection during PDF generation, and multi-source Source Type.
- RC5.5.2 cloud-revision conflict protection, restore points, and workspace import/export.

## Data and migration

No database migration is required. Alternate definitions and item assignments are stored inside the existing quote workspace JSON. Development and verification do not modify live Supabase data.
