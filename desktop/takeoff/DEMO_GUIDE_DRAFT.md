# ScopeLogic Software Demo Guide — Living Draft

> Development companion. Keep this file synchronized with implemented behavior so future demos describe what the software actually does, including its limits.

## 1. 30-second positioning

ScopeLogic is a construction estimating and preconstruction platform built around controlled information flow. The core workflow connects drawings, takeoff quantities, Rules/Assemblies, BOM/labor, estimating, quote revisions, scope, proposal generation, and bid review without allowing upstream changes to silently rewrite downstream pricing.

The desktop Takeoff application is the drawing-side companion. It is designed to be capable of serving as a contractor's primary quantity takeoff tool while staying connected to the shared ScopeLogic estimating platform.

## 2. Core product principle

**No silent downstream changes.**

A drawing mark or changed takeoff quantity does not automatically change an estimate, BOM, labor extension, or quote. The user reviews differences in Sync Review and deliberately applies selected changes.

Primary controlled flow:

**Drawing Mark / Measurement → Takeoff Quantity → Sync Review → Estimate Quantity → Rules / Assemblies → BOM / Labor / Pricing**

## 3. Recommended demo sequence

### A. Open a drawing set

1. Open a multi-page PDF.
2. Show the page navigator with true PDF thumbnails.
3. Demonstrate page labels when supplied by the PDF.
4. Use drawing search to locate text across the sheet set.
5. Filter sheets by All / Counted / Measured / Scaled status.

Talking point: ScopeLogic treats the drawing set as an estimating workspace, not merely a PDF viewer.

### B. Set scale

1. Select an architectural preset scale, or use two-point calibration.
2. Show page-specific scale status.
3. Explain that measurement geometry is stored independently from the displayed calculated value, allowing the page scale to be corrected without redrawing every measurement.

Current limit: preset scales assume the PDF retains its native print scale; manual calibration should be used when that assumption is uncertain.

### C. Build and use the Tool Chest

1. Create a count tool.
2. Select Circle, Square, Triangle, or Diamond.
3. Set color, quantity multiplier, and result unit.
4. Place count marks.
5. Show live quantity totals.

Talking point: count marks store normalized page coordinates, so the takeoff remains aligned while zoom changes.

Current limit: shared company/project Tool Chest cloud synchronization is a later integration phase. The current desktop phase uses local tools.

### D. Measurement takeoff

Demonstrate:
- Distance
- Polyline
- Area
- Perimeter

Show measurement values and page-scale dependency.

Talking point: measurement records remain takeoff data until deliberately connected downstream.

### E. Drawing navigation and search

Show:
- lazy-rendered page thumbnails
- page-level count status
- page-level measurement status
- page-level scale status
- full-sheet text search
- page filters

Good feature: estimators can quickly find the sheets that have work, incomplete scaling, or active takeoff instead of manually tracking sheet status.

### F. Sync Review

1. Place several marks.
2. Open Sync Review.
3. Show Takeoff Qty, Estimate Qty, and Difference.
4. Deselect one row.
5. Apply only selected changes.

Critical talking point: this is the control point that prevents a drawing edit from silently rewriting a quote.

Current limit: the present desktop phase applies approved changes to a local estimate preview. Cloud Quote/BOM writeback is a later integration phase.

### G. Markups and snippets

Planned/current development area:
- text note
- line
- arrow
- rectangle
- cloud
- highlight
- freehand
- rectangular snippet capture
- optional generic reference/issue ID

Talking point: annotations are intentionally separate from quantity takeoff. A markup does not affect quantities unless the user later creates an explicit relationship.

## 4. Current Takeoff strengths

- Multi-page PDF viewing
- True PDF thumbnails
- Sheet/page text search
- Page-label support
- Zoom and page navigation
- Per-page architectural scale presets
- Manual two-point calibration
- Count tools with reusable Tool Chest records
- Circle / Square / Triangle / Diamond count shapes
- Quantity multipliers and units
- Distance, polyline, area, and perimeter measurements
- Live count and measurement summary
- Sheet filters and status indicators
- Explicit Sync Review
- Quantity provenance concept built into the workflow
- Desktop/Tauri architecture for local performance and future offline use
- Universal trade architecture rather than low-voltage-only hardcoding

## 5. Current Takeoff limits — state these clearly in a demo

- Cloud project synchronization is not complete yet.
- Cloud company/project Tool Chest synchronization is not complete yet.
- Approved Sync Review changes currently stop at the local estimate preview; shared Quote/BOM writeback is not complete yet.
- Rule/Assembly-driven BOM and labor impact from Takeoff is planned but not fully connected yet.
- Drawing revision/overlay comparison is planned.
- Marked-up PDF export is planned.
- Full project-file persistence/recovery is being implemented.
- Advanced annotation/snippet workflow is being implemented.
- The current desktop application is under active development and should not be represented as a finished commercial release.

## 6. ScopeLogic estimating-platform strengths to demonstrate later

- Shared Quote Engine
- Material, labor, and other/direct cost structure
- Markup / sell / GP / margin calculations
- Alternates
- Revisions and controlled history
- Scope / inclusions / exclusions
- Proposal generation
- Catalog and supplier pricing foundation
- Labor schedules
- Assemblies
- Rules Engine
- Document/project context
- Bid Review foundation
- Controlled synchronization architecture

## 7. SLC versus commercial software

The application foundation is shared, but commercial users must not receive proprietary ScopeLogic Consulting methodology.

**SLC/internal configuration:**
- consulting branding/configuration
- Recommended Base Bid (RBB)
- private consulting methodology and workflows

**Commercial software configuration:**
- shared estimating/takeoff platform
- no RBB
- no substitute feature that recreates RBB decision logic

RBB must be disabled as an actual entitlement/capability, not merely hidden visually.

## 8. Demo storyline for an estimator

A strong estimator-focused demo should tell one continuous story:

1. Open project drawings.
2. Search and navigate to the relevant sheets.
3. Calibrate the drawing.
4. Select or create Takeoff tools.
5. Perform count and measurement takeoff.
6. Review live quantities.
7. Make a drawing-side change.
8. Show Sync Required status.
9. Compare Takeoff vs Estimate quantities.
10. Apply only approved changes.
11. Later demonstrate Rules/Assemblies converting approved quantities to proposed BOM/labor.
12. Review estimate and proposal output.

The product should feel like one estimating workflow rather than separate PDF, takeoff, BOM, and quote programs stitched together.

## 9. Future slide-deck outline

1. ScopeLogic — What Problem It Solves
2. Product Architecture
3. Controlled Information Flow / No Silent Changes
4. Project and Document Context
5. Desktop Takeoff Workspace
6. Drawing Navigation and Search
7. Scale and Measurement
8. Tool Chest and Count Takeoff
9. Live Takeoff Summary
10. Sync Review
11. Rules + Assemblies + BOM Vision
12. Quote Engine
13. Revision / Proposal / Bid Review
14. What ScopeLogic Does Well
15. Current Product Limits
16. SLC Internal vs Commercial Configuration
17. Roadmap
18. End-to-End Demo Recap

## 10. Development documentation rule

Whenever a meaningful feature is implemented, update this guide with:
- what the feature does
- how to demonstrate it
- why it is useful
- what it does **not** do yet
- any safety/control behavior the user should understand

This keeps the sales/demo story grounded in the actual product rather than a future-state promise.
