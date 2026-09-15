# ScopeLogic Takeoff Desktop

Phase 1 desktop foundation for the ScopeLogic Takeoff add-on.

## Product boundary

Takeoff is a desktop companion to the shared ScopeLogic platform. It is not a separate estimating system. The intended data flow is:

`Drawing Mark → Takeoff Quantity → Sync Review → Estimate Quantity → Rules/Assemblies → BOM/Labor/Pricing → Quote`

**Takeoff never silently overwrites Estimate or BOM quantities.** A user must explicitly review and apply quantity changes.

Drawing annotations are a separate layer. Notes, markups, and snippets do not affect takeoff quantities merely because they exist on a drawing.

## Implemented

- Tauri 2 native desktop shell
- React + TypeScript + Vite frontend
- ScopeLogic native app icon
- Local PDF opening and PDF.js rendering
- Multi-page navigation
- Zoom controls
- compact Pages rail
- lazy-rendered true PDF page thumbnails
- PDF page-label support when the drawing set provides labels
- on-demand full-sheet text search with cached page text and bounded parallel scanning
- drawing page filters for All / Counted / Measured / Scaled sheets
- page-level count, measurement, and scale status in the drawing navigator
- local Tool Chest
- count marks using Circle, Square, Triangle, or Diamond
- quantity multipliers and result units
- live Takeoff Summary
- per-page drawing scale
- architectural preset scales
- manual two-point calibration using feet or inches
- Distance measurement
- Polyline measurement
- Area measurement
- Perimeter measurement
- zoom-independent measurement geometry stored in normalized page coordinates
- explicit Sync Review with Takeoff Qty / Estimate Qty / Difference
- selected-row apply action
- measurement data remains independent of Estimate/BOM quantities
- text-note markup
- line markup
- arrow markup
- rectangle markup
- cloud-style markup
- highlight markup
- freehand markup
- rectangular drawing snippets with page/source bounds
- optional snippet image preview captured from the rendered PDF page
- generic Reference / Issue ID and note fields on markups and snippets
- dedicated Annotations panel with edit, page navigation, selection, and delete behavior
- local recovery snapshot with schema versioning
- explicit Restore Session / Start Fresh recovery prompt
- recovery of Tool Chest, marks, measurements, scales, markups, snippets, estimate preview, Sync Review selection, page, and zoom
- PDF fingerprint/name check when reconnecting a recovered session to its source drawing
- ScopeLogic workstation UI density aligned with the approved Quote/BOM interface

The Phase 1 Estimate quantity is a local preview. Cloud Quote/BOM writes are intentionally not enabled yet.

The local recovery snapshot does not currently store the PDF file itself. If a session is restored after the application restarts, the user reopens the source PDF and ScopeLogic reconnects the preserved takeoff data to it.

## Development

Prerequisites:

- Node.js
- Rust toolchain
- platform prerequisites required by Tauri 2

From `desktop/takeoff`:

```bash
npm install
npm run dev
```

Run in the native desktop shell:

```bash
npm run desktop:dev
```

Validate the frontend:

```bash
npm run build
```

Validate the native shell without producing installers:

```bash
npm run desktop:build
```

## Next implementation phases

1. Authenticate the desktop application against the shared ScopeLogic platform and load authorized projects.
2. Synchronize company/project Tool Chest data while retaining local/offline-safe behavior.
3. Link Takeoff tools to shared Rules/Assemblies and show proposed BOM/labor impact in Sync Review.
4. Write only explicitly approved Sync Review changes into the shared Quote/BOM engine.
5. Add drawing revision/overlay comparison and revision-impact review.
6. Add marked-up PDF export and more advanced annotation editing.
7. Replace/augment browser WebView recovery storage with a durable native project cache/file layer appropriate for production offline use.

ScopeLogic Consulting and ScopeLogic Software can use the same Takeoff engine. Consulting-only methodology remains outside the universal commercial Takeoff feature set unless deliberately generalized.
