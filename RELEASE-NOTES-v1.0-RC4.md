# ScopeLogic v1.0 RC4 — Release Notes

## Production workflow

- Reorders navigation to Project, Deliverables, Project Control, and Administration.
- Places Project Setup above Dashboard.
- Places ScopeLogic Internal Matrix below Internal Notes.
- Removes Bid Leveling Summary.
- Replaces Production Setup with System Status.

## Internal Matrix

- Full-width entry form with a compact submitted-SLR list below it.
- Multi-system selection for each SLR.
- Per-system Recommended Bid Basis fields.
- Document Reference terminology.
- Removes active Reason / Basis and Contractor Response fields.

## Deliverables

- Recommended SOW Matrix expands multi-system SLRs under every applicable system.
- Clarification Matrix and Formal RFI retain one SLR/RFI while listing all systems.
- The Formal RFI PDF contains only RFI number, systems, and question; internal answer tracking is not exported.
- Contractor Response Checklist remains one editable PDF divided into system sections.
- Snippet Register lists all applicable systems.

## Project administration

- Cloud document rename and Retry Cloud Upload actions.
- Revised Contract Information sections and calculations.
- Responsive Dashboard cards with improved wrapping and spacing.
- Integrated email delivery, email settings, Resend route, and Resend variables removed.

## Database

Migration:

```text
20260806000100_scopelogic_rc4_product_simplification.sql
```

The migration is additive and preserves legacy RC3.1 fields and data.
