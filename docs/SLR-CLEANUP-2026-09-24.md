# SLR checklist numbering and conservative cleanup

Branch: `fix/slr-canonical-controller-20260923`

Approved starting revision: `7425cb70418130db861fbc7858ff24329877bc95`

## Exact changes

| File | Change |
| --- | --- |
| `app/slr-approved-preview-exact.css` | Change only the checklist heading prefix from empty to `8. ` for both supported shells. All other CSS, import order, colors, icons, spacing and breakpoints are unchanged. |
| `app/slr-approved-layout-behavior.tsx` | Skip redundant class writes; cancel the pending animation frame on unmount. Preserve the guarded template text update that prevents the previous observer loop, and preserve the existing Save SLR forwarding behavior. |
| `app/slr-deliverables-editor-v2.tsx` | Remove the duplicate selection-triggered load and side effects from the state updater. The existing selection effect now owns the reset and single load. Cancel pending animation frames and event reload timers on unmount. Keep the host-placement guard, event refreshes, cloud queries, CRUD and draft/submission behavior. |
| `scripts/test-slr-ui.cjs` | Add an isolated browser regression harness using the real child editor, GC/VE editor, action behavior and all layout styles; mock the cloud boundary. |
| `docs/SLR-CLEANUP-2026-09-24.md` | This dependency audit and validation record. |

**Files removed: none. Imports removed: none. CSS rules deleted: none.**
Removed executable redundancy: the second GC/VE load on each SLR selection and unnecessary writes of existing action classes. No dependencies or lockfiles changed.

## Verification

- Locked dependencies installed successfully; production build, prebuild recovery verification, TypeScript and static page generation passed. The first sandboxed attempt compiled but its TypeScript child process was blocked (`spawn EPERM`); rerun with process access passed.
- Browser regression passed in headless Edge at widths 1440, 768 and 390 for both `.app-shell` and `.workspace-shell`. Baseline/current screenshots had zero differing pixels outside the intentionally masked checklist title area. The actual computed checklist prefix was independently asserted as `8. `.
- Twenty-one successive SLR selections produced exactly one GC/VE lookup each, one portal host and one Save SLR action. Observers settled while idle; no browser exceptions occurred.
- Save SLR, Submit Entry and SLR as Template callbacks, adding RFI/checklist children, GC collapse/expand, new-form reset on selection, editor removal/reappearance and pending event reload cancellation passed with mocked cloud operations.
- `git diff --check` passed.
- `npm run verify-source` (the older `verify-clean-source.mjs`) still fails with **35 identical failures on both the approved baseline and this update**. They concern four existing native-dialog files, outdated workspace/PDF text expectations, and cloud implementation checks still aimed at the wrapper instead of `cloud-workspace-legacy.ts`. The build already uses the newer recovery verifier. This pass does not weaken or rewrite either verifier.

These are component/browser regression checks, not an authenticated end-to-end test of the full workspace or live cloud writes. Save/submit persistence and real project switching still warrant an authenticated smoke test before production promotion. This update does not deploy or merge to production.

### Reproduce the browser regression

The harness expects `esbuild`, `playwright` and `pngjs` resolvable by Node. Install them in a separate tooling directory and set `NODE_PATH` to its `node_modules` to avoid modifying the application dependency manifest. This run used esbuild 0.25.12 and pngjs 7.0.0 with the bundled Playwright runtime and installed Edge.

Set `SLR_BASELINE_REF=7425cb70418130db861fbc7858ff24329877bc95`, optionally `SLR_BROWSER_CHANNEL=msedge`, and run `node scripts/test-slr-ui.cjs` from the repository root. Without a browser channel, install the Chromium browser required by Playwright. Results and comparison images are written to ignored `.verification/slr/`.

## Legacy dependencies retained

- `app/layout.tsx` retains the exact stylesheet order and currently mounted controllers. `SlrChildEditor` remains mounted by `workspace.tsx`; the approved GC/VE and action controllers remain mounted by the layout.
- `globals.css`, `commercial-facelift.css`, `workspace-density.css`, `workstation-uniformity-v2.css` through `v5.css`, `slr-green-banners.css`, `slr-inline-editor.css`, `slr-review-update.css`, `deliverables-preview-v2.css`, `slr-approved-layout.css` and the other layout styles remain loaded. The final preview stylesheet is an override layer, not a complete replacement. For example, inline CSS keeps the matrix embedded in the workspace, while the base approved sheet still supplies child cards, fields, footer behavior and responsive rules. Removing a whole layer is not proven equivalent.
- `SlrDeliverablesEditorV2` still depends on its guarded DOM portal placement and observer for the existing workspace integration. `SlrApprovedLayoutBehavior` still supplies the bottom Save action and template label. Removing either requires a separately validated native React replacement.
- `slr-deliverables-workflow.tsx`, `slr-review-update-behavior.tsx`, `project-workflow-enhancer.tsx` and `slr-template-search-enhancer.tsx` have no incoming references in the current repository search and remain unmounted. They were disabled in the prior repair. Unreferenced does not prove feature equivalence: these files include older read-only/preview behavior, review label handling, project browsing and template/quote/takeoff search. They are retained for a feature-parity audit rather than deleted or re-enabled during this appearance-preserving pass.
- `lib/cloud-workspace-legacy.ts` is actively imported and re-exported by the protected `cloud-workspace.ts` wrapper. It is not dead code. `review-release-pdf.ts` is still imported by the V2 PDF implementation; its legacy name is not grounds for deletion.
- Existing in-flight cloud requests are not cancelled by this cleanup; only scheduled callbacks are cancelled. Async response ordering and replacing global DOM observers remain separate follow-up work requiring populated, authenticated project regression coverage.
