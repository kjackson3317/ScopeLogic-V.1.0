# Employer demonstration

Application: Technology Preconstruction Workspace.
Variant: `NEXT_PUBLIC_APP_VARIANT=employer-demo`.
Branch: `demo/employer-presentation`. Never merge the demo deployment environment file into production.

## Isolation

The demo uses fictional bundled data and browser-local storage. Its Supabase client is replaced by a local adapter; the server client fails closed. Middleware blocks API/auth routes, and the browser CSP permits only same-origin connections. The deployment build removes production branding, samples and templates from its disposable public directory. No production database migration or deployment is needed.

The existing workspace source is retained. The demo-only loader applies checked, exact-context workspace additions from `scripts/demo-workspace-transform.json`, then neutral branding. It fails the build if upstream workspace context changes rather than silently applying an invalid edit. Review the adapter when updating the production base.

## Presentation (5–10 minutes)

1. Open the fictional Municipal Public Safety Facility project.
2. Open Review Notes / Deliverables / Bid Alignment. Show the Scope Matrix, clarifications, RFIs, VE opportunities and contractor checklist. Add a review note and use Create SLR from note.
3. Show Bid Alignment Report. Unpriced scope differences are explicitly unpriced. Use Print / Save PDF for review reports.
4. Return to Project / Estimating and open Drawing Take Off. Use Focus Drawing for laptop presentations.
5. Calibrate the endpoints of the labeled 60 ft dimension. Click Finish and acknowledge the saved message.
6. Select Dual Data. The seeded 24 locations represent 48 cable channels. Add, select, move or delete a mark; use Undo. Filters show sheet/system/tool totals. Use Distance, Polyline, Area or Perimeter and Finish to save measurements.
7. Sync Counts to Take Off, open Take Off Rules, select the quote and Update Quote from Take Off. Repeating the update replaces generated rows without duplicating quantities.
8. Quote Builder shows the six assembly components and labor. Save changes. Set Status to Approved to generate an official quote PDF, or use Preview Quote without locking it.
9. Generate Official Release stores the combined PDF locally. Official Releases lists the browser's archived releases.
10. Reset Demo restores the fictional starting project, review records and drawings and removes local demo releases.

## Persistence and limits

All edits stay in the current browser/profile on the demo origin. Clearing site data or Reset Demo removes them. It is a single-browser presentation, not a multiuser system. Production administration/authentication and cloud restore operations are outside the demo. The review-deliverables adapter supports the seeded master project; creating production-style master projects is outside the walkthrough.

## Verification

Verified on Vercel on 2026-09-16: the recovery-source verifier passed, the Next.js production build compiled successfully, TypeScript completed successfully, all static pages generated, and the deployment reached READY. The rendered root uses Technology Preconstruction Workspace branding, neutral Presentation Workspace loading copy, demo icon/wordmark assets, same-origin CSP, and the `x-demo-storage: browser-local-only` response header. No production branch, production deployment, or production Supabase migration was changed.

Browser-flow coverage is defined in `scripts/demo-flow-check.cjs`: calibrated distance/polyline/area/perimeter, count/edit/delete/undo, assembly quantities, repeated quote updates, navigation and reload persistence, review-note-to-SLR, all review views, PDF releases and absence of external browser requests.

## Neutral deployment target

The branch is ready to deploy to a separate neutral Vercel project. An existing unlinked project named `estimating-workspace-demo` is suitable and already owns the neutral domain `estimating-workspace-demo.vercel.app`. Connect that Vercel project to `kjackson3317/ScopeLogic-V.1.0`, set its production branch to `demo/employer-presentation`, and deploy. The demo branch's ignore script blocks builds in the existing SLC Vercel projects while allowing a different neutral project ID to build normally.

Rollback: retire the separate demo deployment or redeploy its previous commit. Production remains on its existing branch, deployment and database.
