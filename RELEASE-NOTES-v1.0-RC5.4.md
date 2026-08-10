# ScopeLogic v1.0 RC5.4 — Integrated PDF Drawing Take Off & Estimating

## Purpose
RC5.4 combines the standalone PDF Takeoff prototype with the existing ScopeLogic estimating, Take Off rule engine, Parts Database, Quote Builder, Scope of Work, and customer quote workflow.

## Integrated Drawing Take Off
- New **Estimating → Drawing Take Off** workspace.
- Uses current PDF files already stored in **Project Documents**; there is no separate drawing library.
- Multi-page PDF rendering with PDF.js.
- Page navigation and zoom.
- Per-page scale calibration.
- Distance, polyline, area, and perimeter measurement tools.
- Rectangle, cloud, arrow, highlight, and Snippet / SLR drawing annotations.
- Count symbols using square, triangle, circle, or diamond markers.
- No starter tools or preloaded takeoff rules are included.
- Tool Chest items can be global or project-only.
- Each count tool can optionally link to an existing Take Off rule.
- Live count summary shows locations and multiplied output quantity.
- Selected count marks can be removed.

## Drawing-to-Estimating Link
- **Sync Counts to Take Off** converts linked drawing counts into drawing-sourced Take Off quantities.
- Re-syncing replaces the previous drawing-sourced quantity instead of stacking it repeatedly.
- Manual Take Off quantities remain separate and are added to drawing-sourced quantities for the same rule.
- The Take Off Quantity Sheet displays the drawing contribution and combined rule quantity.
- Existing project-level rule activation remains authoritative: a linked rule does not affect material/labor calculations unless the estimator activates that rule for the project.
- Existing average cable length, direct multiply, capacity, cable/package threshold, pooled demand, part consolidation, and Quote Builder logic remain intact.

## SLR Integration
- Snippet / SLR regions create a normal ScopeLogic SLR entry using the selected drawing reference and page number.
- The new SLR enters the existing Internal Matrix / RFI / Recommended SOW / checklist workflow rather than a parallel issue database.

## Persistence
- Drawing tools, marks, measurements, calibrations, and annotations are stored inside the existing `user_settings.estimating_data` JSON payload.
- Existing project PDF files continue to use the private `project-files` storage bucket.
- The standalone prototype's browser-only `localStorage` data model is not used.
- No Supabase migration is required for RC5.4.

## PDF.js Packaging
- Adds `pdfjs-dist` 4.10.38.
- A postinstall script copies the PDF.js worker to `public/pdf.worker.min.mjs` for local and Vercel builds.

## Existing RC5.3.5 Features Retained
- Mass Parts Database import and pricing update.
- Full Parts Database XLSX export using the import-template format.
- Manufacturer A–Z Parts Database/export ordering.
- Case-insensitive unique Part Number enforcement.
- Job-specific BOM grouping and reordering.
- Quote Templates.
- Travel / hotel / per diem calculations.
- Unified Scope of Work editor.
- Approved-only professional customer quote PDF with optional BOM.
- Responsive/mobile workspace behavior.

## Acceptance Focus
1. Upload/open a project drawing PDF and verify all pages render.
2. Calibrate a page and verify distance/area values.
3. Create a Tool Chest item linked to a Take Off rule.
4. Place count marks, sync, and confirm the Drawing quantity appears in Take Off.
5. Change the drawing count and re-sync; confirm the prior drawing quantity is replaced, not added again.
6. Confirm inactive Take Off rules still do not generate parts/labor.
7. Activate the rule, update a quote, and confirm consolidated parts/labor.
8. Create an SLR from a drawing region and confirm it appears in the Internal Matrix.
9. Repeat critical actions at mobile width.
