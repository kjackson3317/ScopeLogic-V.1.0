# ScopeLogic v1.0 RC5 — Acceptance Checklist

## Deployment and schema

- [ ] Vercel deployment is Ready.
- [ ] Custom domain opens ScopeLogic over HTTPS.
- [ ] Migrations `20260806000300` and `20260806000400` match under Local and Remote.
- [ ] `npx supabase@latest db push` reports the remote database is up to date.
- [ ] System Status reports schema version `1.0-RC5`.
- [ ] ScopeLogic displays `Cloud synced`.

## Existing data and accepted RC4.1 behavior

- [ ] Existing projects, customers, SLR numbers, contracts, and cloud documents remain intact.
- [ ] Recommended SOW shows one row per SLR with per-system recommendation sections.
- [ ] Clarification Matrix shows one row per SLR.
- [ ] Formal RFI PDF has no Answer field.
- [ ] Contractor Checklist remains one editable PDF with system sections and per-system checklist wording.

## Mobile navigation

Test at a phone-width viewport and on a physical phone when available.

- [ ] Menu button is always visible.
- [ ] Close control closes the drawer.
- [ ] Tapping the shaded area closes the drawer.
- [ ] Selecting a page closes the drawer.
- [ ] Switch Projects closes the drawer and opens Project Library.
- [ ] Browser Back closes the drawer before leaving the current page.
- [ ] Escape closes the drawer with a keyboard attached.
- [ ] Background scrolling is locked while the drawer is open.
- [ ] Rotating the phone does not leave the drawer stuck.

## Mobile workflow

- [ ] Header shows project, cloud status, Menu, and Actions without horizontal overflow.
- [ ] Internal Matrix fields stack and remain readable.
- [ ] Affected-system choices are easy to tap.
- [ ] Submit Entry remains reachable during a long SLR edit.
- [ ] Submitted SLRs display as readable cards.
- [ ] Documents, Dashboard, Contract Information, System Status, and deliverables have no page-level horizontal scrolling.
- [ ] Complex tables scroll inside their own container.
- [ ] Dialogs and PDF previews fit the mobile viewport.

## Official releases and backup

- [ ] Official Release numbering, Current/Superseded status, archive Preview, Download, snapshot, and SHA-256 behavior pass.
- [ ] Project backup ZIP contains `manifest.json` and available document bytes.
- [ ] Restore creates a new project and does not alter the original.

## AI disabled production check

- [ ] Production `SCOPELOGIC_AI_ENABLED=false` keeps AI drafting unavailable.
- [ ] System Status shows `Configured — disabled` when the API key is present.
- [ ] All non-AI ScopeLogic functions work while AI is disabled.

## AI preview acceptance

- [ ] Preview environment has `SCOPELOGIC_AI_ENABLED=true` and the server-only `OPENAI_API_KEY`.
- [ ] Anonymous requests to the AI route are rejected.
- [ ] AI Draft Assistant requires a selected SLR draft and at least one affected system.
- [ ] Prompt generates all five approved field types.
- [ ] One recommendation and checklist item are returned for every selected system.
- [ ] Document Reference is not invented or changed.
- [ ] Existing populated fields are unchecked by default.
- [ ] Selected fields apply; unselected fields remain unchanged.
- [ ] Additional-system suggestions are not added automatically.
- [ ] Applied AI text remains an unsubmitted draft until Submit Entry is selected.
- [ ] Refresh after submission preserves applied fields and internal provenance.
- [ ] No AI provenance appears in Recommended SOW, Clarification Matrix, Formal RFI, Contractor Checklist, or Snippet Register PDFs.
- [ ] Timeout, disabled-feature, and rate-limit errors display in the application without losing draft text.

## Final tag

- [ ] Production AI is enabled only after preview acceptance.
- [ ] One controlled Production AI draft test passes.
- [ ] Working tree is clean.
- [ ] Git tag `v1.0.0` is created and pushed.
