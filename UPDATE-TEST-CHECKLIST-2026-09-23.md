# ScopeLogic Update Test Checklist — 2026-09-23

Project protection reference: SLMP-26011 was snapshotted before the update.

## Required user tests

1. Review Note -> Create SLR
   - Open a Review Note and choose Create SLR.
   - Confirm these fields can be filled before creating the SLR: Topic / Scope Item, Scope Concern, Source Type / Source Reference, Formal RFI Question, Recommended Bid Basis / Solution.
   - Create the SLR and confirm those values appear on the SLR.

2. GC Clarification deletion persistence
   - Create or open an SLR that originated from a Review Note with Include in Clarifications selected.
   - Delete its GC Clarification and confirm the delete.
   - Save the SLR, leave the SLR, reopen it, refresh the browser, and reopen the project.
   - Expected: the deleted clarification does not return. The original Review Note remains.
   - Explicitly add a new GC Clarification again.
   - Expected: a new clarification can be created normally.

3. GC Clarification / VE location and collapse
   - Open an SLR containing GC Clarifications and VE Opportunities.
   - Expected: both sections are at the bottom of the SLR.
   - Collapse and expand each section independently.
   - Expected: collapsing one does not collapse the other and no data is lost.

4. Interim SLR save
   - Edit an SLR and click Save SLR before you are finished.
   - Expected: the SLR remains open, entered data stays populated/editable, no full loading/splash page appears, and no automatic navigation to Project Library occurs.
   - Expected: an in-app success message appears. On a forced/real failure, an error message should appear.

5. Project SLR list
   - Open Internal Matrix.
   - Expected: project-scoped SLR list appears at the top.
   - Select an SLR.
   - Expected: selected SLR opens and the list can collapse/reopen.

6. Review Note deletion
   - Delete a disposable Review Note.
   - Expected: confirmation is required; successful deletion shows an in-app confirmation; linked SLR is not deleted.

7. Project Library
   - Open Project Library.
   - Expected: only the 5 most recently worked-on projects show by default.
   - Search by project number and project name.
   - Choose View All Projects with blank search.
   - Expected: all projects display in project-number order.
   - Test Delete on a disposable project with no linked engagements.
   - Expected: confirmation is required and success/failure feedback is shown.

8. Current Master Project label
   - Open a project with a long name.
   - Expected: left sidebar displays complete project number and name without ellipsis/truncation.

9. Draft numbering stability
   - Note the numbers of at least two non-submitted SLRs and any draft RFI/RBB/checklist children.
   - Edit/reorder/delete a different draft record, save, refresh, and reopen.
   - Expected: existing draft numbers do not silently change or compact. Submitted/released numbers also remain unchanged.

10. Deliverable summary / branding
    - Generate a PDF Preview using ScopeLogic branding, then CEFI branding, then Neutral / Unbranded.
    - Expected: Project Review Summary is first; CEFI output has CEFI/non-ScopeLogic branding; neutral output has no ScopeLogic branding.
    - Confirm project/job, location, status, revision/version date, systems, and included deliverables are correct.

11. Internal Matrix / deliverable synchronization regression
    - Edit an SLR concern/RFI/RBB and save.
    - Edit an SLR-owned GC Clarification or VE and save.
    - Refresh corresponding read-only Deliverables preview.
    - Expected: current saved values appear once, do not revert, and one deliverable does not overwrite another.

## Regression checks

- Existing project 26011 data remains present.
- Review Notes remain grouped and editable as before.
- Existing RFI/RBB/checklist child workflows still operate.
- Deliverables menu remains read-only preview.
- Official releases remain immutable.
- Unrelated estimating, quoting, CRM, documents, takeoff, and project functionality is unchanged.

## Report failures

For any failed item, provide the checklist number, project/SLR number, exact action taken, expected result, actual result, and screenshot/error text if available.
