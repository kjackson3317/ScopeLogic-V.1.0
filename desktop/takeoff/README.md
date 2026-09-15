# ScopeLogic Takeoff Desktop

Phase 1 desktop foundation for the ScopeLogic Takeoff add-on.

## Product boundary

Takeoff is a desktop companion to the shared ScopeLogic platform. It is not a separate estimating system. The intended data flow is:

`Drawing Mark → Takeoff Quantity → Sync Review → Estimate Quantity → Rules/Assemblies → BOM/Labor/Pricing → Quote`

**Takeoff never silently overwrites Estimate or BOM quantities.** A user must explicitly review and apply quantity changes.

## Phase 1 implemented

- Tauri 2 native desktop shell
- React + TypeScript + Vite frontend
- Local PDF opening and PDF.js rendering
- Multi-page navigation
- Zoom controls
- compact Pages rail
- local Tool Chest
- count marks using Circle, Square, Triangle, or Diamond
- quantity multipliers and result units
- live Takeoff Summary
- explicit Sync Review with Takeoff Qty / Estimate Qty / Difference
- selected-row apply action
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

1. Bring existing ScopeLogic calibration and measurement logic into the desktop shell: distance, polyline, area, perimeter, preset/manual scales.
2. Render true page thumbnails and add drawing-set organization/search.
3. Bring over markup/snippet tools and linked issue support where appropriate.
4. Add local project persistence/cache and recovery.
5. Authenticate against the shared ScopeLogic platform and sync company/project Tool Chest data.
6. Link tools to shared Rules/Assemblies and show resulting BOM/labor impact in Sync Review.
7. Write approved Sync Review changes into the shared Quote/BOM engine.
8. Add drawing revision/overlay comparison and marked-up PDF export.

SLC and SLS will use the same Takeoff engine. SLC-only consulting methodology (including RBB) remains outside the commercial Takeoff feature set.
