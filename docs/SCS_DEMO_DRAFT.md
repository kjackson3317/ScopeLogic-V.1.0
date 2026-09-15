# SCS Demo Draft — Living Development Document

> Working demo script and slide-outline source. Update this document as features stabilize. It intentionally distinguishes current capability, preview capability, and planned capability so demonstrations do not overstate the product.

## Demo Objective

Explain how ScopeLogic organizes a project from source documents through review, scope decisions, estimating, and final deliverables while preserving traceability and requiring explicit user approval before downstream changes.

## Core Product Story

ScopeLogic is organized around a **Master Project**. Client-specific work, quotes, consulting engagements, documents, review evidence, SLRs, RFIs, Recommended Base Bid decisions, contractor checklist items, takeoff, and estimating outputs belong beneath that project hierarchy rather than living in separate disconnected project libraries.

### Design principle

**Capture evidence first. Make the scope decision second. Apply downstream changes explicitly.**

That principle appears throughout the product:

- Document review evidence is collected before an SLR is finalized.
- Drawing takeoff quantities require Sync Review before changing an estimate/BOM.
- RFI links provide traceability but do not silently rewrite a released recommendation.
- Templates preload reusable content but do not silently create project-specific conclusions.

---

## Proposed Demo Flow

### 1. Master Project Library

Show the Master Project Library as the only project-level library.

Explain:
- A Master Project represents the physical construction project.
- Address fields are normal Address 1 / Address 2 / City / State / ZIP fields and are all optional.
- Client Engagements sit beneath a Master Project.
- Quotes and client deliverables belong to a Client Engagement, but project intelligence is shared at the Master Project level.

Good feature:
- Avoids duplicate project records when multiple GCs/CMs or consulting engagements relate to the same physical project.

Limit / current implementation note:
- The live SLC application still has legacy engagement/project records internally. The goal is to keep those records as implementation detail while exposing only the Master Project Library to the user.

### 2. Document Review Workflow

Show the workflow strip:

**Capture Evidence → Group by Topic → Synthesize → RFI / RBB / Checklist**

Explain why it exists:
- Reviewers often find a requirement in specifications and the related or conflicting requirement many pages later in drawings.
- Writing the finished SLR at the instant the first note is found creates unnecessary rework and context switching.
- ScopeLogic separates **review evidence** from the **final SLR conclusion**.

#### Capture Review Note

Fields:
- System
- Topic
- Source type
- Source reference
- Observation

Example:
- System: Structured Cabling
- Topic: Copper Cabling Category
- Source: Specification
- Reference: 27 10 00 §2.3.A
- Observation: Cat 6A required for horizontal cabling.

Then capture a drawing note under the same System + Topic.

Good feature:
- System + Topic keeps related information together without forcing the reviewer to stop and edit an SLR every time another relevant note is found.

Limit:
- Topic selection is intentionally lightweight. It is not meant to be a rigid taxonomy that slows document review.

### 3. Grouped Evidence

Open an Evidence Group and show specification and drawing evidence together.

Explain:
- Groups are generated from System + Topic.
- Multiple source types are visible together.
- References are retained.
- The reviewer decides whether the evidence results in no action, a checklist item, a new SLR, or an update/link to an existing SLR.

Good feature:
- Makes contradictions and omissions easier to see before formal scope language is written.

### 4. Create or Update an SLR

Show the synthesized SLR draft generated from the evidence group.

Explain:
- ScopeLogic preloads the evidence and references.
- The reviewer still owns the conclusion.
- The draft is staged before being promoted to the Internal Matrix.
- Existing SLRs can receive additional evidence instead of creating duplicates.

Limit:
- ScopeLogic should not pretend evidence grouping proves there is a conflict. The human reviewer decides whether an SLR is warranted.

### 5. SLR / RFI / RBB relationship

Explain the hierarchy:

**Evidence → SLR → optional RFI → optional Recommended Base Bid → optional Contractor Checklist**

#### Based on RFI

Explain exactly:
- An RBB section can link to one or more RFIs by unique ID.
- The link is internal traceability.
- It does not automatically copy an RFI response into the RBB.
- It does not silently rewrite pricing or scope.
- Released customer-visible recommendation text remains controlled even if internal traceability is updated.

Good feature:
- A reviewer can later answer, “Why did we carry this bid basis?” and trace it to the RFI(s) that supported the decision.

### 6. Template Library

Demonstrate two separate template concepts.

#### Contractor Checklist Templates

Use for recurring confirmations such as:
- permits
- submittals
- as-builts
- O&M manuals
- training
- testing/certification
- labeling
- warranty

Behavior:
- Standard pack can be applied to a project.
- Items become project-specific copies.
- Editing the project copy does not modify the global template.
- Checklist templates do **not** require an SLR.

#### SLR Templates

Use for recurring scope-risk patterns such as:
- network equipment responsibility
- MDF/IDF buildout undefined
- existing system integration

Behavior:
- User explicitly chooses a template.
- Template preloads issue language and optional RFI/checklist language.
- It never automatically creates a project conclusion.

Good feature:
- Reduces repetitive data entry without polluting the project with irrelevant SLRs.

### 7. Quote / Estimate

Demonstrate the approved compact quote UI standard.

Show:
- BOM rows
- material cost
- labor minutes
- markup
- alternates
- breakouts
- summary/adders
- proposal generation

Good feature:
- Dense estimator-focused workstation UI rather than oversized web-form controls.

### 8. Desktop Takeoff

Planned/active development story:

**Drawing Mark → Takeoff Quantity → Sync Review → Estimate Quantity → BOM / Labor / Pricing**

Good features under development:
- multi-page PDF viewing
- page thumbnails
- search
- scale calibration
- counts
- distance/polyline/area/perimeter
- Tool Chest
- annotations/snippets
- local recovery
- explicit Sync Review

Critical limit / safety feature:
- Takeoff does not silently overwrite estimate or BOM quantities.

### 9. Deliverables

Show SOW, Clarification Log, Formal RFI, Contractor Checklist, and release history as appropriate.

Explain:
- Customer-facing content is generated from controlled project records.
- Released records can be locked/versioned.
- Internal traceability remains richer than the external PDF.

---

## Demo Slide Outline

1. **ScopeLogic — Project Intelligence from Documents to Bid**
2. **One Master Project, Multiple Client Engagements**
3. **The Review Problem: Evidence Appears in Different Places**
4. **Capture First, Synthesize Second**
5. **Review Notes & Evidence Groups**
6. **Evidence to SLR**
7. **SLR → RFI → RBB → Checklist**
8. **Reusable Templates Without Creating Noise**
9. **Estimating & Quote Engine**
10. **Desktop Takeoff + Explicit Sync Review**
11. **Controlled Deliverables & Release History**
12. **What ScopeLogic Does Well / Current Limits**

---

## Capability / Limitation Register

| Area | Good Feature | Current / Intended Limit |
|---|---|---|
| Master Projects | One project hierarchy for shared intelligence and multiple engagements | Legacy engagement records may remain internally even when hidden from user navigation |
| Review Notes | Fast evidence capture without forcing immediate conclusions | Does not automatically determine that evidence is a conflict |
| Evidence Groups | Combines related spec/drawing/addendum evidence | Topic quality still depends on reviewer naming discipline |
| SLR Templates | Faster reuse of recurring scope concerns | Templates never prove applicability; user must choose them |
| Checklist Templates | Standard recurring bidder confirmations | Project copy must remain editable and independent of master template |
| RFI linkage | Traceable relationship to RBB | RFI response does not silently rewrite an RBB |
| Takeoff | Quantity workflow connected to rules/BOM | No silent estimate/BOM overwrite; user approval required |
| AI assistance | Can assist with organization, extraction, and drafting | Human remains responsible for project interpretation and issued scope decisions |

---

## Development Status Legend for Future Slides

Use one of these labels on demo material:

- **LIVE** — available and validated in current production SLC.
- **PREVIEW** — implemented on a feature branch / prototype but not production-approved.
- **PLANNED** — designed but not yet operational.

Never present PREVIEW or PLANNED functionality as LIVE during a customer demonstration.
