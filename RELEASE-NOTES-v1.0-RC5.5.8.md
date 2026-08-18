# ScopeLogic v1.0 RC5.5.8

RC5.5.8 refines pricing breakouts, project navigation, takeoff controls, quote numbering, and RFI reference visibility. It is a code-only release and does not require a Supabase migration.

## Pricing breakouts and alternates

- Breakout allocation follows the Base Bid BOM order and repeats the same group/header structure.
- Quote-level pricing and general conditions are allocated into named breakouts instead of appearing as a separate General Conditions row.
- Automatic allocation uses each breakout's direct-price share. Manual mode accepts per-breakout percentages and normalizes them to 100 percent so the summary reconciles.
- Alternate pricing displays total labor hours directly below its short Scope of Work, alongside Material, Labor, and signed Alternate Total.
- Existing negative quantities, repeated part numbers, Base Bid isolation, alternate award controls, and purchasing reconciliation remain intact.

## Projects, calendar, and quote numbers

- Project Library now prioritizes searchable project and quote information, with Quote Numbers visible and projects sorted newest-first.
- Calendar has its own Project navigation tab.
- Project Setup includes Important Dates with a subject and date; saved entries immediately appear on the Calendar.
- New automatic quote numbers use compact forms: `Q-0101`, `Q-0101-R1`, `Q-0101-C1`, and `Q-0101-C1-R1`.
- Legacy long-form numbers remain readable and are displayed in the compact format when a quote is opened.

## Takeoff, parts, travel, and RFI

- Drawing Take Off uses a larger workspace, click-and-drag panning, and mouse-wheel zoom.
- Snippet Register navigation, takeoff controls, and release/PDF output are removed.
- Parts Database no longer shows Category, System, or Vendor columns.
- Travel Time Calculator is fixed to Installation labor and no longer presents a Labor Type selector.
- Formal RFI shows Document References in the internal view as well as the PDF.
- Quote Setup fields and responsive styles were tightened to prevent label and text-box overlap.

## ScopeLogic Help

- Renamed the Administration standards tab to **ScopeLogic Help**.
- Expanded it into a searchable in-app how-to guide for projects, scope review, quote creation, Base Bid, breakouts, alternates, purchasing, proposal controls, takeoff, parts, labor, releases, and backups.
- Retained the operating standards and Internal Matrix field-to-deliverable reference below the how-to topics.

## Compatibility and data protection

- The release retains responsive layout, collapsible navigation, alphanumeric sorting, BOM selection during proposal generation, multi-source Source Type, explicit Save/Delete controls, and destructive confirmation behavior.
- New settings are optional fields in existing workspace JSON; Project Setup dates reuse existing calendar records.
- No database schema change or migration is required.
- The staged release was built without reading from or writing to live Supabase data.

