# ScopeLogic v1.0 RC4.1 — Acceptance Checklist

## Deployment and schema

- [ ] Vercel deployment is Ready.
- [ ] All three required Vercel variables are assigned to Production.
- [ ] Migration `20260806000200` is present under Local and Remote.
- [ ] System Status reports schema version `RC4.1`.
- [ ] Header reports `Cloud synced`.

## Existing data

- [ ] Existing projects, customers, contacts, notes, contracts, SLRs, and documents remain visible.
- [ ] Existing single-system SLRs retain their system and recommendation.
- [ ] Existing RC4 checklist wording is preserved under the applicable selected systems.
- [ ] Existing cloud documents open and download.

## Internal Matrix

- [ ] One SLR can select multiple systems.
- [ ] Each selected system has a separate Recommended Bid Basis field.
- [ ] Each selected system has a separate Contractor Checklist Scope Item field.
- [ ] Removing a system with recommendation or checklist text requires confirmation.
- [ ] A blank checklist field excludes only that system from the checklist.

## Deliverables

- [ ] Recommended SOW shows each SLR only once.
- [ ] Recommended SOW lists all affected systems in the same row.
- [ ] Recommended SOW contains labeled per-system recommendations inside one Recommended Bid Basis cell.
- [ ] Clarification Matrix shows each SLR only once.
- [ ] Clarification Matrix lists all systems and labeled per-system recommendations in the same row.
- [ ] Formal RFI PDF omits the Answer field while the internal answer remains available.
- [ ] Contractor Response Checklist is one editable PDF divided into system sections.
- [ ] Each checklist section uses that system's specific scope item.
- [ ] Response dropdowns and Reason fields work in Bluebeam or Acrobat.

## Cloud regression

- [ ] A multi-system SLR survives refresh.
- [ ] A second-browser edit appears in the original browser.
- [ ] An original-browser edit appears in the second browser.
- [ ] Both browsers remain Cloud synced.
