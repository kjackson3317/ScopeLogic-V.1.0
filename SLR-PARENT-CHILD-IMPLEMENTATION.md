# SLR Parent/Child Upgrade

Implementation branch only. Production remains unchanged.

Approved model: SLR is the parent scope concern; RFIs, Recommend Base Bid records, and contractor checklist questions are child records. Numbering is automatic. Draft numbers may resequence; numbers included in an Official Release are permanent. Multi-system RBB records use stable project system suffixes. Clarification Log shows associated RFI/RBB numbers but not checklist content. Recommended SOW remains one SLR row with per-system RBB text stacked in the recommendation cell. Formal RFI stays customer-clean with no SLR cross-reference or answer box.

Production-safety rules: legacy Official Releases remain the authoritative immutable archive. Migration backfills parent number locks plus legacy RFI, RBB, and checklist child records; customer-visible legacy child content is marked released/locked so the upgrade cannot silently overwrite it. Blank legacy identifiers are never treated as release matches. The schema-health RPC includes every new SLR child/locking column before cloud writes are allowed. Locked RFIs may progress Issued → Answered → Closed but cannot return to Draft. Templates receive fresh child UUIDs when instantiated so reusable template records cannot collide with project child identities.
