# ScopeLogic Software Demo Guide — Living Draft

> Development companion. Keep this file synchronized with implemented behavior so future demos describe what the software actually does, including its limits.

## 1. 30-second positioning

ScopeLogic is a construction estimating and preconstruction platform built around controlled information flow. The core workflow connects drawings, takeoff quantities, Rules/Assemblies, BOM/labor, estimating, quote revisions, scope, proposal generation, and bid review without allowing upstream changes to silently rewrite downstream pricing.

The desktop Takeoff application is the drawing-side companion. It is being designed to serve as a contractor's primary quantity takeoff tool while remaining connected to the shared ScopeLogic estimating platform.

## 2. Core product principle

**No silent downstream changes.**

A drawing mark or changed takeoff quantity does not automatically change an estimate, BOM, labor extension, or quote. The user reviews differences in Sync Review and deliberately applies selected changes.

Primary controlled flow:

**Drawing Mark / Measurement → Takeoff Quantity → Sync Review → Estimate Quantity → Rules / Assemblies → BOM / Labor / Pricing**

Drawing annotations are intentionally separate:

**Drawing Note / Markup / Snippet → Annotation Record → optional Reference / Issue Link**

An annotation does not change quantity simply because it was placed on a drawing.

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

### F. Markups, snippets, and references

Demonstrate the implemented annotation tools:
- Text note
- Line
- Arrow
- Rectangle
- Cloud-style markup
- Highlight
- Freehand
- Rectangular snippet capture

For a snippet:
1. Capture a rectangular drawing region.
2. Open the Annotations tab.
3. Show its page/source reference and image preview when available.
4. Add a title and note.
5. Add an optional generic Reference / Issue ID.
6. Click the list item to return to the source page.

Talking point: annotations and snippets are a separate layer from quantity takeoff. Adding or deleting one does not change count or measurement quantities.

Good feature: a user can preserve the drawing context behind an issue without embedding consulting-specific methodology into the commercial Takeoff tool.

Current limit: advanced markup editing such as drag-to-resize/move and marked-up PDF export is not complete yet.

### G. Recovery and interrupted-work protection

1. Perform takeoff work and make annotations.
2. Explain that ScopeLogic locally preserves the working state.
3. On a subsequent application start, show the explicit **Recovered Takeoff Session** prompt.
4. Choose Restore Session.
5. Reopen the source PDF when prompted.
6. Show that Tool Chest records, marks, measurements, scales, annotations, snippets, estimate preview, Sync Review state, page, and zoom are restored.

Talking point: automatic preservation is allowed, but workflow decisions remain explicit. ScopeLogic does not silently restore questionable data or push recovered work into a quote.

Current limit: the current recovery layer stores project state in the local WebView/browser storage and does not persist the PDF bytes themselves. A production-grade native project cache/file layer is a later hardening phase.

### H. Sync Review

1. Place several count marks.
2. Open Sync Review.
3. Show Takeoff Qty, Estimate Qty, and Difference.
4. Deselect one row.
5. Apply only selected changes.

Critical talking point: this is the control point that prevents a drawing edit from silently rewriting a quote.

Current limit: the present desktop phase applies approved changes to a local estimate preview. Cloud Quote/BOM writeback is a later integration phase.

## 4. Current Takeoff strengths

- Multi-page PDF viewing
- True PDF thumbnails
- Sheet/page text search
- Page-label support
- Zoom and page navigation
- Page filters by takeoff/scale activity
- Per-page architectural scale presets
- Manual two-point calibration
- Count tools with reusable local Tool Chest records
- Circle / Square / Triangle / Diamond count shapes
- Quantity multipliers and units
- Distance, polyline, area, and perimeter measurements
- Live count and measurement summary
- Separate markup/annotation layer
- Text, line, arrow, rectangle, cloud-style, highlight, and freehand markups
- Drawing snippet capture with normalized source bounds
- Snippet image preview when the rendered PDF page can be captured
- Generic issue/reference IDs and notes without SLC-only methodology
- Dedicated Annotations panel
- Explicit Sync Review
- Local recovery with an explicit restore decision
- Schema-versioned recovery model for future migration
- Quantity provenance/control concept built into the workflow
- Desktop/Tauri architecture for local performance and future offline use
- Universal trade architecture rather than low-voltage-only hardcoding
- Compact ScopeLogic estimator-workstation UI aligned with the approved Quote/BOM interface

## 5. Current Takeoff limits — state these clearly in a demo

- Cloud project synchronization is not complete yet.
- Cloud company/project Tool Chest synchronization is not complete yet.
- Approved Sync Review changes currently stop at the local estimate preview; shared Quote/BOM writeback is not complete yet.
- Rule/Assembly-driven BOM and labor impact from Takeoff is planned but not fully connected yet.
- Drawing revision/overlay comparison is planned.
- Marked-up PDF export is planned.
- Advanced annotation editing such as drag/move/resize is not complete yet.
- Local recovery currently uses the desktop WebView's local storage rather than a final native project-file/cache implementation.
- The source PDF itself is not stored inside the current recovery snapshot and must be reopened after a restored application session.
- Cloud/offline conflict handling is not implemented because cloud synchronization is not connected yet.
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

The desktop Takeoff annotation/reference system remains generic so the same Takeoff engine can serve both configurations without exposing consulting methodology.

## 8. Demo storyline for an estimator

A strong estimator-focused demo should tell one continuous story:

1. Open project drawings.
2. Search and navigate to the relevant sheets.
3. Calibrate the drawing.
4. Select or create Takeoff tools.
5. Perform count and measurement takeoff.
6. Add an annotation and capture a snippet for a drawing condition that needs attention.
7. Add a generic reference/issue ID to preserve traceability.
8. Review live quantities.
9. Make a drawing-side count change.
10. Show Sync Required status.
11. Compare Takeoff vs Estimate quantities.
12. Apply only approved changes.
13. Demonstrate local interrupted-work recovery if useful for the audience.
14. Later demonstrate Rules/Assemblies converting approved quantities to proposed BOM/labor.
15. Review estimate and proposal output.

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
9. Markups, Snippets, and Traceability
10. Interrupted-Work Recovery
11. Live Takeoff Summary
12. Sync Review
13. Rules + Assemblies + BOM Vision
14. Quote Engine
15. Revision / Proposal / Bid Review
16. What ScopeLogic Does Well
17. Current Product Limits
18. SLC Internal vs Commercial Configuration
19. Roadmap
20. End-to-End Demo Recap

## 10. Recommended demo language: implemented vs roadmap

Use these labels consistently:

- **Available now in the development build** — the feature can actually be demonstrated.
- **Foundation implemented** — supporting architecture exists but the complete customer workflow is not connected.
- **Roadmap** — do not present as currently available.

Examples:

- PDF navigation/search: **Available now in the development build**
- Counts/measurements/scaling: **Available now in the development build**
- Markups/snippets/local recovery: **Available now in the development build**
- Local Sync Review: **Available now in the development build**
- Cloud Quote/BOM writeback: **Roadmap**
- Cloud Tool Chest/project sync: **Roadmap**
- Rule/Assembly BOM impact from Takeoff: **Foundation/roadmap until connected**
- Drawing revision overlay: **Roadmap**

## 11. Development documentation rule

Whenever a meaningful feature is implemented, update this guide with:
- what the feature does
- how to demonstrate it
- why it is useful
- what it does **not** do yet
- any safety/control behavior the user should understand

This keeps the sales/demo story grounded in the actual product rather than a future-state promise.
