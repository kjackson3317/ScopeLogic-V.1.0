# ScopeLogic v1.0 RC4.1 — Release Notes

## Purpose

Correct the final presentation and data-entry behavior for multi-system SLRs without reopening the broader RC4 feature scope.

## Corrected behavior

### Recommended SOW Matrix

- One SLR produces one matrix row.
- All affected systems are listed in the Systems cell.
- The Recommended Bid Basis cell contains a separate labeled recommendation section for each selected system.

### Clarification Matrix

- One SLR remains one matrix row.
- All affected systems and recommendations remain within that row.

### Contractor Response Checklist

- Every selected system has an independent Contractor Checklist Scope Item.
- The final output remains one editable PDF divided into system sections.
- An SLR appears in a system section only when that system's checklist item contains text.

## Data preservation

Migration `20260806000200` adds `checklist_scope_items_by_system`. Existing RC4 shared checklist wording is copied to each selected system so no previously entered checklist scope is lost.
