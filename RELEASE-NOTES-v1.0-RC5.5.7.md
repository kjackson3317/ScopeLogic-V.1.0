# ScopeLogic v1.0 RC5.5.7

RC5.5.7 adds the approved quote-summary pricing controls and completes the current estimating and document-layout batch. It is a code-only release and does not require a Supabase migration.

## Quote summary pricing

- Added **Misc Material Adder** as a percentage of base material cost with its own markup.
- Changed **Shipping** to a percentage of base material cost with its own markup. Existing quotes that contain a fixed shipping amount keep that amount until the percentage is edited.
- Added **Misc Labor Adder** as a percentage of adjusted installation labor hours.
- Added quote-level **Material Handling** and **Overtime** installation-hour fields.
- Added separately priced non-taxable fields for **Lift Money**, **Parking Money**, **Connex Rental**, and **Permit**, each with its own markup.
- Retained **Other Non-Taxable** as a separate cost and markup field.
- All adders flow into internal cost, customer price, tax where applicable, breakout general conditions, and proposal totals.

## Summary layout

- Travel and Hotel / Per Diem remain at the top of the summary sidebar.
- Non-taxable job costs appear directly below travel.
- Material and labor adders appear above Internal Notes.
- Internal Notes expands into the remaining sidebar space.
- Removed the Terms and Admin Notes controls from this summary area without deleting any existing saved values.
- Save and Delete controls remain available at both the top and bottom of the working area.

## Project management and commission

- Added quote-level Project Manager hours to the labor summary without adding Project Manager labor to individual BOM rows.
- Added internal commission as either a percentage of total pre-tax price or a custom amount.
- Commission reduces displayed internal profit and margin only; it does not change the customer price or proposal.

## Project Library and document output

- Project Library is ordered by creation date, newest first, and displays the quote numbers within each project.
- Formal RFI PDF includes a dedicated **Document References** column sourced from each RFI's Source Reference.
- Customer proposal totals include all new taxable and non-taxable adders while preserving the existing detailed-versus-total-only pricing choice.
- Reduced the BOM Material Markup column width while retaining individual markup and Use Global behavior.

## Compatibility and data protection

- Quote-summary fields are stored inside the existing quote estimating data.
- No database schema change or migration is required.
- Existing automatic quote numbers, revisions, change orders, quote duplication/templates, alternates, breakout allocations, rich Scope of Work editing, responsive navigation, alphanumeric sorting, BOM selection for proposal generation, and multi-source Source Type behavior remain intact.
