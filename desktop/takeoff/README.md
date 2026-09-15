# ScopeLogic Takeoff Desktop

Phase 1 desktop foundation for the ScopeLogic Takeoff add-on.

## Product boundary

Takeoff is a desktop companion to the shared ScopeLogic platform. It is not a separate estimating system. The intended data flow is:

`Drawing Mark → Takeoff Quantity → Sync Review → Estimate Quantity → Rules/Assemblies → BOM/Labor/Pricing → Quote`

**Takeoff never silently overwrites Estimate or BOM quantities.** A user must explicitly review and apply quantity changes.

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
- ScopeLogic workstation UI density aligned with the approved Quote/BOM interface

The Phase 1 Estimate quantity is a local preview. Cloud Quote/BOM writes are intentionally not enabled yet.

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

1. Bring over markup/snippet tools and linked issue support where appropriate.
2. Add local project persistence/cache and recovery.
3. Authenticate against the shared ScopeLogic platform and sync company/project Tool Chest data.
4. Link tools to shared Rules/Assemblies and show resulting BOM/labor impact in Sync Review.
5. Write approved Sync Review changes into the shared Quote/BOM engine.
6. Add drawing revision/overlay comparison and marked-up PDF export.

ScopeLogic Consulting and ScopeLogic Software can use the same Takeoff engine. Consulting-only methodology remains outside the universal commercial Takeoff feature set unless deliberately generalized.
