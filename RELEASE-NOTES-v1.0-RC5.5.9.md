# ScopeLogic v1.0 RC5.5.9

RC5.5.9 converts Drawing Take Off into a drawing-first workspace. It is a code-only release and does not require a Supabase migration.

## Full-width drawing workspace

- Moved Drawing Tools and the saved Tool Chest into a collapsible horizontal dock above the PDF; it opens compact by default so the drawing remains immediately visible.
- Moved the Live Take Off Summary, Page Measurements, and Rule Links into a collapsible tabbed dock below the PDF.
- Expanded the PDF canvas to the full available workspace width.
- Added Focus Drawing mode with a compact top control bar, collapsed auxiliary docks, and an always-visible Exit Focus control.
- Kept tool creation, count syncing, calibration, measurements, markups, and rule linking in their existing workflows.

## Zoom and navigation

- Added Fit Page and Fit Width controls.
- Expanded zoom to 8%–600%, with a direct percentage entry field.
- Mouse-wheel zoom now stays centered on the pointer position.
- Added click-and-drag panning, temporary Spacebar panning, and keyboard shortcuts: `+`, `-`, and `0` for Fit Page.
- Added document margins and centering so the complete sheet remains visible when zoomed below the viewport size.
- Added progressive raster limits so extreme zoom remains usable without creating unsafe full-resolution canvases.

## Responsive behavior and compatibility

- Tool and summary docks collapse into single-column layouts on smaller screens.
- The viewer maintains a large, bounded working height across desktop and mobile sizes.
- Existing normalized marks, annotations, measurements, tool links, and drawing-sourced takeoff quantities remain compatible.
- Calibration math now uses the PDF page's scale-independent coordinate space so zoom changes do not alter new measurement results.

## Validation and migration

- Source verification, TypeScript validation, responsive overlap checks, and a complete Vercel production build are required before packaging.
- No database migration is required; RC5.5.9 uses the existing drawing takeoff data model.

