# Employer demonstration

Application: Technology Preconstruction Workspace.
Variant: `NEXT_PUBLIC_APP_VARIANT=employer-demo`.
Branch: `demo/employer-presentation`. Never merge the demo deployment environment file into production.

## Isolation

The demo uses fictional bundled data and browser-local storage. Its Supabase client is replaced by a local adapter; the server client fails closed. Middleware blocks API/auth routes, and the browser CSP permits only same-origin connections. The deployment build removes production branding, samples and templates from its disposable public directory. No production database migration or deployment is needed.

The existing workspace source is retained. Demo-only build transforms apply checked, exact-context workspace additions and neutral branding. The build fails if upstream workspace context changes rather than silently applying an invalid edit. Production source remains unchanged by this employer demo.

## Current presentation workflow

1. Open the fictional Municipal Public Safety Facility - Rev 2 project.
2. Open Internal Notes. The page is a split workspace: Internal Notes on the left and Project Review on the right. Review observations can be saved and promoted to an SLR without opening a separate review page.
3. Open the SLR Matrix and show the finding lifecycle. SLRs can drive Recommended Base Bid, GC Clarification, Formal RFI, VE, Contractor Scope Confirmation, and Bid Alignment actions.
4. In the SLR Template Library, use keyword search plus System and Output filters to narrow the reusable template list. The demo contains sanitized copies of the 18 currently saved SLR templates. Selecting a result feeds the existing Use Template workflow; project-specific references, released numbers and responses are not carried into the new SLR.
5. Open Deliverables. All formal downstream outputs are consolidated into one workspace with tabs for Recommended Base Bid, GC Clarifications, Formal RFIs, VE Opportunities, Contractor Confirmation, Bid Alignment, and Reports / Releases.
6. Show estimating setup, Parts & Labor, Take Off Rules, Base Bid, alternates, breakouts, Quote Builder, proposals, and releases as appropriate for the presentation.
7. Drawing Takeoff is intentionally not embedded in the browser workspace. Use the separate Technology Preconstruction Takeoff Windows desktop application for drawing review and takeoff.
8. In the desktop Takeoff app, open a PDF, use Fit Page / Fit Width, cursor-centered wheel zoom, free pan, Select / Pan / Count modes, calibration, count tools, and distance / polyline / area / perimeter measurements.
9. Demonstrate the docked Takeoff Totals panel. Its divider can be dragged vertically, the panel can be collapsed/restored, and tabs expose Takeoff Totals, Measurements, Rule Links, and Sync Review.
10. Current desktop Sync Review applies approved quantities to a local estimate preview only. Shared browser Quote/BOM writeback remains a later integration step and must not be represented as live in this demo.
11. Reset Demo restores the fictional browser starting project and removes local browser releases.

## SLR template search

The SLR Template Library is designed for a large future template catalog rather than a single dropdown. Search covers the template name and reusable scope logic such as concern text, recommendation/bid basis, RFI language, references and checklist language. Filters can narrow results by affected System and intended Output/action: RBB, GC Clarification, Formal RFI or Checklist. The result counter shows how many templates remain after filtering.

The employer demo uses browser-local copies of the saved templates. It does not read the production `slr_templates` table. Production uses the same search/filter interface over the existing live template table.

## Persistence and limits

Browser edits stay in the current browser/profile on the demo origin. Clearing site data or Reset Demo removes them. It is a single-browser presentation, not a multiuser system. Production administration/authentication and cloud restore operations are outside the demo.

The desktop Takeoff application keeps its current demo/session state locally on the workstation. The native demo is intended for local PDF takeoff testing and does not write directly to production systems.

## Verification target

The employer browser demo must show Technology Preconstruction Workspace branding, the embedded Internal Notes + Project Review layout, one consolidated Deliverables workspace, searchable/filterable SLR templates, and no browser Drawing Takeoff navigation. The separate Windows Takeoff application must remain white-label and isolated from production.

## Neutral deployment target

The neutral Vercel project is `estimating-workspace-demo`, using `estimating-workspace-demo.vercel.app`, connected to `kjackson3317/ScopeLogic-V.1.0` with production branch `demo/employer-presentation`.

Rollback: retire the separate demo deployment or redeploy its previous commit. Production remains on its existing branch, deployment and database.
