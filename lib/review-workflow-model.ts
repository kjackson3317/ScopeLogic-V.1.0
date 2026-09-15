export type ReviewSourceType = 'Specification' | 'Drawing' | 'Addendum' | 'Narrative' | 'Meeting' | 'Field' | 'Other';

export type ReviewNoteDisposition = 'Unreviewed' | 'No Action' | 'Checklist' | 'SLR' | 'Linked to SLR';

export type ReviewNote = {
  id: string;
  masterProjectId: string;
  engagementLegacyId?: string;
  system: string;
  topic: string;
  sourceType: ReviewSourceType;
  sourceReference: string;
  note: string;
  snippetLabel?: string;
  disposition: ReviewNoteDisposition;
  linkedSlrUid?: string;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceGroup = {
  key: string;
  masterProjectId: string;
  system: string;
  topic: string;
  notes: ReviewNote[];
  sourceTypes: ReviewSourceType[];
  referenceText: string;
};

export type ReviewSlrDraft = {
  title: string;
  system: string;
  systems: string[];
  concern: string;
  reference: string;
  sourceType: string;
  sourceNoteIds: string[];
};

export type ChecklistTemplateItem = {
  id: string;
  category: string;
  system: string;
  question: string;
  enabledByDefault: boolean;
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  description: string;
  items: ChecklistTemplateItem[];
};

export type SlrTemplateSummary = {
  id: string;
  name: string;
  system: string;
  whenToUse: string;
  defaultConcern: string;
  defaultRfi?: string;
  defaultChecklist?: string;
};

export const STANDARD_CHECKLIST_TEMPLATE: ChecklistTemplate = {
  id: 'scope-logic-standard',
  name: 'ScopeLogic Standard Contractor Checklist',
  description: 'Common commercial requirements that should be confirmed on most projects. Items are copied into the project and can then be edited independently.',
  items: [
    { id: 'permits', category: 'General Requirements', system: 'General', question: 'All permits, licenses, inspection fees, and authority-required fees applicable to this scope are included.', enabledByDefault: true },
    { id: 'submittals', category: 'Submittals / Closeout', system: 'General', question: 'All required product data, shop drawings, coordination drawings, and other submittals are included.', enabledByDefault: true },
    { id: 'as-builts', category: 'Submittals / Closeout', system: 'General', question: 'Record drawings / as-built documentation required by the contract documents are included.', enabledByDefault: true },
    { id: 'om-manuals', category: 'Submittals / Closeout', system: 'General', question: 'Required O&M manuals and closeout documentation are included.', enabledByDefault: true },
    { id: 'training', category: 'Training / Turnover', system: 'General', question: 'Owner training and demonstrations required by the contract documents are included.', enabledByDefault: true },
    { id: 'testing', category: 'Testing / Commissioning', system: 'General', question: 'Required testing, certification, commissioning support, and test reports are included.', enabledByDefault: true },
    { id: 'labeling', category: 'Installation', system: 'General', question: 'Required device, cable, panel, pathway, and equipment labeling is included.', enabledByDefault: true },
    { id: 'warranty', category: 'Submittals / Closeout', system: 'General', question: 'Contract-required manufacturer and installation warranties are included.', enabledByDefault: true },
  ],
};

export const STARTER_SLR_TEMPLATES: SlrTemplateSummary[] = [
  {
    id: 'network-equipment-responsibility',
    name: 'Network Equipment Responsibility',
    system: 'Network Electronics',
    whenToUse: 'Use when drawings/specifications conflict or are unclear about owner-furnished versus contractor-furnished network electronics.',
    defaultConcern: 'The contract documents are unclear or inconsistent regarding responsibility for furnishing, installing, configuring, or commissioning network electronics.',
    defaultRfi: 'Clarify responsibility for furnishing, installing, configuring, and commissioning the network electronics shown or referenced in the contract documents.',
    defaultChecklist: 'Confirm the proposal clearly identifies all included and excluded network electronics responsibilities.',
  },
  {
    id: 'mdf-idf-buildout',
    name: 'MDF / IDF Buildout Undefined',
    system: 'Structured Cabling',
    whenToUse: 'Use when racks, cabinets, patch panels, cable management, fiber enclosures, or room buildout requirements are incomplete or contradictory.',
    defaultConcern: 'MDF / IDF room buildout requirements are not fully defined or are inconsistent between drawings and specifications.',
    defaultRfi: 'Clarify the complete MDF / IDF buildout requirements, including racks/cabinets, patch panels, cable management, fiber enclosures, and related accessories.',
    defaultChecklist: 'Confirm all required MDF / IDF racks, cabinets, patch panels, cable management, fiber enclosures, and accessories are included.',
  },
  {
    id: 'existing-system-integration',
    name: 'Existing System Integration',
    system: 'Other',
    whenToUse: 'Use on renovations when new work must connect to, reuse, migrate, or coexist with an existing system.',
    defaultConcern: 'The required extent of integration with the existing system is not fully defined.',
    defaultRfi: 'Clarify the required extent of integration, reuse, migration, programming, testing, and responsibility for the existing system.',
    defaultChecklist: 'Confirm all required existing-system integration, migration, programming, and testing is included or specifically excluded.',
  },
];

const normalized = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizedKey = (value: string) => normalized(value).toLocaleLowerCase();

export function evidenceGroupKey(note: Pick<ReviewNote, 'system' | 'topic'>) {
  return `${normalizedKey(note.system)}::${normalizedKey(note.topic)}`;
}

export function groupReviewNotes(notes: ReviewNote[]): EvidenceGroup[] {
  const groups = new Map<string, EvidenceGroup>();
  for (const note of notes) {
    if (!normalized(note.topic)) continue;
    const key = evidenceGroupKey(note);
    const existing = groups.get(key) || {
      key,
      masterProjectId: note.masterProjectId,
      system: normalized(note.system) || 'Other',
      topic: normalized(note.topic),
      notes: [],
      sourceTypes: [],
      referenceText: '',
    };
    existing.notes.push(note);
    if (!existing.sourceTypes.includes(note.sourceType)) existing.sourceTypes.push(note.sourceType);
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      notes: [...group.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      sourceTypes: [...group.sourceTypes].sort(),
      referenceText: group.notes
        .map((note) => normalized(note.sourceReference))
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .join('; '),
    }))
    .sort((a, b) => `${a.system} ${a.topic}`.localeCompare(`${b.system} ${b.topic}`, undefined, { sensitivity: 'base', numeric: true }));
}

export function buildSlrDraftFromEvidence(group: EvidenceGroup): ReviewSlrDraft {
  const evidenceLines = group.notes.map((note) => {
    const reference = normalized(note.sourceReference) || note.sourceType;
    return `${reference}: ${normalized(note.note)}`;
  });
  return {
    title: group.topic,
    system: group.system,
    systems: [group.system],
    concern: evidenceLines.join('\n'),
    reference: group.referenceText,
    sourceType: group.sourceTypes.join(', '),
    sourceNoteIds: group.notes.map((note) => note.id),
  };
}

export function reviewGroupRecommendation(group: EvidenceGroup) {
  const sourceCount = group.sourceTypes.length;
  if (group.notes.length >= 2 && sourceCount >= 2) return 'Compare sources before deciding whether an SLR is required.';
  if (group.notes.length >= 2) return 'Review the combined notes before creating or updating an SLR.';
  return 'Continue review; one observation may not yet justify an SLR.';
}
