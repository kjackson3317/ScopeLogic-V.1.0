# ScopeLogic Update Notes — 2026-09-23

This update is intentionally limited to the revisions requested for the current ScopeLogic review workflow.

## Root cause corrected

GC Clarifications created from Review Note -> Create SLR -> Include in Clarifications were able to return after deletion because the canonical database flag was cleared by the delete path, but a later legacy workspace save could still carry an older in-memory `clarification=true` value back into the SLR row. That re-enabled the automatic deliverable synchronization and regenerated the clarification.

The update now preserves the deletion at both layers: the database records the SLR exclusion when the CL is deleted, and the cloud workspace save path suppresses the stale browser clarification flag for that Master Project / SLR until the user explicitly creates a new GC Clarification again.

## Requested workflow changes included

- Review Note -> Create SLR supports Topic / Scope Item, Scope Concern, Source Type / Source Reference, Formal RFI Question, and Recommended Bid Basis / Solution before SLR creation.
- GC Clarifications and VE Opportunities remain at the bottom of the SLR and are independently collapsible.
- Interim SLR save is kept in-place with visible action feedback.
- Review Notes can be deleted with confirmation without deleting a linked SLR.
- Internal Matrix includes a project-scoped collapsible SLR browser.
- Current Master Project sidebar identity shows the complete project number and name.
- Project Library defaults to the five most recently worked-on projects, supports number/name search, View All sorted by project number, and controlled project deletion.
- Deliverable PDF workflow includes a Project Review Summary and ScopeLogic / CEFI / Neutral branding profiles.
- Existing non-submitted SLR and child numbers are preserved during ordinary updates so gaps are not silently compacted/resequenced.
- Global action notifications surface existing success/failure messages as in-app toasts.

## Data protection

SLMP-26011 was snapshotted before the update. The update does not perform a data migration that rewrites the project's SLR/review content.
