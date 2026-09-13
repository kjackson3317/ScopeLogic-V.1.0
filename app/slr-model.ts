export const SLR_SYSTEM_ORDER = [
  'Access Control',
  'Audio Visual',
  'CCTV',
  'Fire Alarm',
  'Intrusion Detection',
  'Network Electronics',
  'Paging / Intercom',
  'Structured Cabling',
  'Video Intercom',
  'Other',
];

export type RfiStatus = 'Draft' | 'Issued' | 'Answered' | 'Closed';
export type RbbStatus = 'Draft' | 'Current' | 'Confirmed' | 'Superseded';
export type ChecklistStatus = 'Open' | 'Reviewed' | 'Complete';

export type SlrRfiChild = {
  uid: string;
  number: string;
  title: string;
  systems: string[];
  question: string;
  reference: string;
  status: RfiStatus;
  response: string;
  responseDate: string;
  responseSource: string;
  includeInFormalRfi: boolean;
  locked: boolean;
  releasedAt: string;
  relatedChildNumbers: string[];
};

export type SlrRbbSection = {
  uid: string;
  system: string;
  suffix: string;
  displayNumber: string;
  recommendation: string;
  status: RbbStatus;
  locked: boolean;
  contentReleased: boolean;
  releasedAt: string;
  supersedesNumber: string;
  basedOnRfiUids: string[];
};

export type SlrRbbChild = {
  uid: string;
  baseSequence: number;
  baseNumber: string;
  title: string;
  selectedSystems: string[];
  forceSuffix: boolean;
  sections: Record<string, SlrRbbSection>;
};

export type SlrChecklistChild = {
  uid: string;
  number: string;
  system: string;
  question: string;
  status: ChecklistStatus;
  response: string;
  responseReason: string;
  locked: boolean;
  releasedAt: string;
  verifiesRbbNumbers: string[];
};

export type SlrChildFields = {
  numberLocked: boolean;
  numberReleasedAt: string;
  rbbScopeLetterMap: Record<string, string>;
  rfis: SlrRfiChild[];
  recommendBaseBids: SlrRbbChild[];
  checklistQuestions: SlrChecklistChild[];
};

export type SlrIssueLike = Partial<SlrChildFields> & {
  uid: string;
  id: string;
  system?: string;
  customSystem?: string;
  systems?: string[];
  recommendations?: Record<string, string>;
  title?: string;
  status?: string;
  concern?: string;
  rfiQuestion?: string;
  basis?: string;
  reference?: string;
  rfi?: string;
  resolution?: string;
  sow?: boolean;
  clarification?: boolean;
  formalRfi?: boolean;
  checklist?: boolean;
  checklistItem?: string;
  checklistItems?: Record<string, string>;
  response?: string;
  responseReason?: string;
  [key: string]: unknown;
};

const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `slr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const text = (value: unknown) => String(value ?? '').trim();
const unique = (values: string[]) => Array.from(new Set(values.map(text).filter(Boolean)));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const padded = (value: number) => String(Math.max(0, value || 0)).padStart(3, '0');
const parseNumber = (value: string, prefix: string) => {
  const match = String(value || '').match(new RegExp(`^${prefix}-(\\d{3})`));
  return match ? Number(match[1]) : 0;
};
const systemRank = (system: string) => {
  const index = SLR_SYSTEM_ORDER.indexOf(system);
  return index < 0 ? 999 : index;
};
const sortedSystems = (systems: string[]) => [...unique(systems)].sort((a, b) => systemRank(a) - systemRank(b) || a.localeCompare(b));

export function blankRfiChild(): SlrRfiChild {
  return {
    uid: uid(), number: '', title: '', systems: [], question: '', reference: '', status: 'Draft',
    response: '', responseDate: '', responseSource: '', includeInFormalRfi: true,
    locked: false, releasedAt: '', relatedChildNumbers: [],
  };
}

export function blankRbbChild(system = ''): SlrRbbChild {
  const systems = system ? [system] : [];
  return {
    uid: uid(), baseSequence: 0, baseNumber: '', title: '', selectedSystems: systems, forceSuffix: false,
    sections: system ? { [system]: blankRbbSection(system) } : {},
  };
}

export function blankRbbSection(system: string): SlrRbbSection {
  return {
    uid: uid(), system, suffix: '', displayNumber: '', recommendation: '', status: 'Current', locked: false,
    contentReleased: false, releasedAt: '', supersedesNumber: '', basedOnRfiUids: [],
  };
}

export function blankChecklistChild(system = ''): SlrChecklistChild {
  return {
    uid: uid(), number: '', system, question: '', status: 'Open', response: '', responseReason: '',
    locked: false, releasedAt: '', verifiesRbbNumbers: [],
  };
}

function normalizedRfi(value: Partial<SlrRfiChild>): SlrRfiChild {
  return {
    ...blankRfiChild(), ...value,
    uid: text(value.uid) || uid(),
    number: text(value.number),
    title: text(value.title),
    systems: unique(Array.isArray(value.systems) ? value.systems : []),
    question: text(value.question),
    reference: text(value.reference),
    response: text(value.response),
    responseDate: text(value.responseDate),
    responseSource: text(value.responseSource),
    relatedChildNumbers: unique(Array.isArray(value.relatedChildNumbers) ? value.relatedChildNumbers : []),
    locked: Boolean(value.locked),
    releasedAt: text(value.releasedAt),
    includeInFormalRfi: value.includeInFormalRfi !== false,
    status: (['Draft', 'Issued', 'Answered', 'Closed'].includes(String(value.status)) ? value.status : 'Draft') as RfiStatus,
  };
}

function normalizedRbbSection(system: string, value?: Partial<SlrRbbSection>): SlrRbbSection {
  return {
    ...blankRbbSection(system), ...(value || {}),
    uid: text(value?.uid) || uid(),
    system,
    suffix: text(value?.suffix).toUpperCase(),
    displayNumber: text(value?.displayNumber),
    recommendation: text(value?.recommendation),
    status: (['Draft', 'Current', 'Confirmed', 'Superseded'].includes(String(value?.status)) ? value?.status : 'Current') as RbbStatus,
    locked: Boolean(value?.locked),
    contentReleased: Boolean(value?.contentReleased),
    releasedAt: text(value?.releasedAt),
    supersedesNumber: text(value?.supersedesNumber),
    basedOnRfiUids: unique(Array.isArray(value?.basedOnRfiUids) ? value!.basedOnRfiUids : []),
  };
}

function normalizedRbb(value: Partial<SlrRbbChild>): SlrRbbChild {
  const selectedSystems = unique(Array.isArray(value.selectedSystems) ? value.selectedSystems : []);
  const sourceSections = value.sections && typeof value.sections === 'object' ? value.sections : {};
  const sections: Record<string, SlrRbbSection> = {};
  selectedSystems.forEach((system) => { sections[system] = normalizedRbbSection(system, sourceSections[system]); });
  return {
    uid: text(value.uid) || uid(),
    baseSequence: Number(value.baseSequence || 0),
    baseNumber: text(value.baseNumber),
    title: text(value.title),
    selectedSystems,
    forceSuffix: Boolean(value.forceSuffix),
    sections,
  };
}

function normalizedChecklist(value: Partial<SlrChecklistChild>): SlrChecklistChild {
  return {
    ...blankChecklistChild(), ...value,
    uid: text(value.uid) || uid(), number: text(value.number), system: text(value.system), question: text(value.question),
    response: text(value.response), responseReason: text(value.responseReason), locked: Boolean(value.locked),
    releasedAt: text(value.releasedAt), verifiesRbbNumbers: unique(Array.isArray(value.verifiesRbbNumbers) ? value.verifiesRbbNumbers : []),
    status: (['Open', 'Reviewed', 'Complete'].includes(String(value.status)) ? value.status : 'Open') as ChecklistStatus,
  };
}

export function normalizeLegacyChildren<T extends SlrIssueLike>(source: T): T & SlrChildFields {
  const issue = clone(source) as T & SlrChildFields;
  const systems = unique(Array.isArray(issue.systems) && issue.systems.length ? issue.systems : [text(issue.system) || 'Structured Cabling']);
  issue.systems = systems;
  issue.system = systems[0] || 'Structured Cabling';
  if (text(issue.status) === 'Answered') issue.status = 'Resolved';
  if (text(issue.status) === 'Answered') issue.status = 'Resolved';

  const existingRfis = Array.isArray(issue.rfis) ? issue.rfis.map(normalizedRfi) : [];
  if (!existingRfis.length && (text(issue.rfiQuestion) || issue.formalRfi)) {
    existingRfis.push(normalizedRfi({
      number: text(issue.rfi), question: text(issue.rfiQuestion) || text(issue.concern), systems,
      reference: text(issue.reference), includeInFormalRfi: Boolean(issue.formalRfi),
      status: text(issue.resolution) ? 'Answered' : 'Draft', response: text(issue.resolution),
    }));
  }
  issue.rfis = existingRfis;

  const existingRbbs = Array.isArray(issue.recommendBaseBids) ? issue.recommendBaseBids.map(normalizedRbb) : [];
  if (!existingRbbs.length) {
    const recommendations = issue.recommendations && typeof issue.recommendations === 'object' ? issue.recommendations : {};
    const selected = unique(Object.entries(recommendations).filter(([, value]) => text(value)).map(([system]) => system));
    if (!selected.length && text(issue.basis)) selected.push(text(issue.system) || 'Structured Cabling');
    if (selected.length) {
      const rbb = blankRbbChild();
      rbb.selectedSystems = selected;
      rbb.sections = Object.fromEntries(selected.map((system) => [system, normalizedRbbSection(system, {
        recommendation: text(recommendations[system]) || (system === issue.system ? text(issue.basis) : ''),
        status: 'Current',
      })]));
      existingRbbs.push(rbb);
    }
  }
  issue.recommendBaseBids = existingRbbs;

  const existingChecklist = Array.isArray(issue.checklistQuestions) ? issue.checklistQuestions.map(normalizedChecklist) : [];
  if (!existingChecklist.length) {
    const legacyItems = issue.checklistItems && typeof issue.checklistItems === 'object' ? issue.checklistItems : {};
    Object.entries(legacyItems).forEach(([system, question]) => {
      if (text(question)) existingChecklist.push(normalizedChecklist({ system, question: text(question), response: text(issue.response), responseReason: text(issue.responseReason) }));
    });
    if (!existingChecklist.length && text(issue.checklistItem)) {
      existingChecklist.push(normalizedChecklist({ system: text(issue.system) || systems[0], question: text(issue.checklistItem), response: text(issue.response), responseReason: text(issue.responseReason) }));
    }
  }
  issue.checklistQuestions = existingChecklist;
  issue.numberLocked = Boolean(issue.numberLocked);
  issue.numberReleasedAt = text(issue.numberReleasedAt);
  issue.rbbScopeLetterMap = issue.rbbScopeLetterMap && typeof issue.rbbScopeLetterMap === 'object' ? Object.fromEntries(Object.entries(issue.rbbScopeLetterMap).map(([system, suffix]) => [text(system), text(suffix).toUpperCase()]).filter(([system, suffix]) => system && suffix)) : {};
  return syncLegacyFields(issue);
}

const nextAvailable = (reserved: Set<number>, used: Set<number>) => {
  let value = 1;
  while (reserved.has(value) || used.has(value)) value += 1;
  used.add(value);
  return value;
};

export function normalizeProjectIssueNumbers<T extends SlrIssueLike>(sources: T[]): Array<T & SlrChildFields> {
  const issues = sources.map((item) => normalizeLegacyChildren(item));

  const lockedSlr = new Set<number>();
  issues.forEach((issue) => { if (issue.numberLocked) { const value = parseNumber(issue.id, 'SLR'); if (value) lockedSlr.add(value); } });
  const usedSlr = new Set<number>();
  issues.forEach((issue) => {
    if (issue.numberLocked && parseNumber(issue.id, 'SLR')) return;
    const value = nextAvailable(lockedSlr, usedSlr);
    issue.id = `SLR-${padded(value)}`;
  });

  const lockedRfi = new Set<number>();
  issues.forEach((issue) => issue.rfis.forEach((rfi) => { if (rfi.locked) { const value = parseNumber(rfi.number, 'RFI'); if (value) lockedRfi.add(value); } }));
  const usedRfi = new Set<number>();
  issues.forEach((issue) => issue.rfis.forEach((rfi) => {
    if (rfi.locked && parseNumber(rfi.number, 'RFI')) return;
    rfi.number = `RFI-${padded(nextAvailable(lockedRfi, usedRfi))}`;
  }));

  const lockedRbb = new Set<number>();
  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => {
    const locked = Object.values(rbb.sections).some((section) => section.locked || section.contentReleased);
    const value = rbb.baseSequence || parseNumber(rbb.baseNumber, 'RBB') || Object.values(rbb.sections).map((section) => parseNumber(section.displayNumber, 'RBB')).find(Boolean) || 0;
    if (locked && value) lockedRbb.add(value);
  }));
  const usedRbb = new Set<number>();
  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => {
    const locked = Object.values(rbb.sections).some((section) => section.locked || section.contentReleased);
    let sequence = rbb.baseSequence || parseNumber(rbb.baseNumber, 'RBB') || 0;
    if (!locked || !sequence) sequence = nextAvailable(lockedRbb, usedRbb);
    else usedRbb.add(sequence);
    rbb.baseSequence = sequence;
    rbb.baseNumber = `RBB-${padded(sequence)}`;
  }));

  const suffixBySystem = new Map<string, string>();
  const usedSuffixes = new Set<string>();
  const captureSuffix = (system: string, suffix: string) => {
    const clean = text(suffix).toUpperCase();
    if (!clean || suffixBySystem.has(system) || usedSuffixes.has(clean)) return;
    suffixBySystem.set(system, clean); usedSuffixes.add(clean);
  };
  issues.forEach((issue) => Object.entries(issue.rbbScopeLetterMap || {}).forEach(([system, suffix]) => captureSuffix(system, suffix)));
  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => Object.values(rbb.sections).forEach((section) => {
    if (section.locked || section.contentReleased) captureSuffix(section.system, section.suffix);
  })));
  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => Object.values(rbb.sections).forEach((section) => captureSuffix(section.system, section.suffix))));
  const allocateSuffix = (system: string) => {
    const existing = suffixBySystem.get(system); if (existing) return existing;
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code);
      if (!usedSuffixes.has(letter)) { suffixBySystem.set(system, letter); usedSuffixes.add(letter); return letter; }
    }
    throw new Error('ScopeLogic supports up to 26 RBB system suffixes per project.');
  };
  const needsSuffixSystems = unique(issues.flatMap((issue) => issue.recommendBaseBids.flatMap((rbb) => (rbb.forceSuffix || rbb.selectedSystems.length > 1) ? rbb.selectedSystems : [])));
  sortedSystems(needsSuffixSystems).forEach(allocateSuffix);
  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => {
    const needsSuffix = rbb.forceSuffix || rbb.selectedSystems.length > 1;
    rbb.selectedSystems.forEach((system) => {
      const section = rbb.sections[system] || normalizedRbbSection(system);
      rbb.sections[system] = section;
      if (section.locked && section.displayNumber) return;
      section.suffix = needsSuffix ? allocateSuffix(system) : '';
      section.displayNumber = `${rbb.baseNumber}${section.suffix}`;
    });
  }));

  const persistedScopeLetterMap = Object.fromEntries(suffixBySystem.entries());
  issues.forEach((issue) => { issue.rbbScopeLetterMap = { ...persistedScopeLetterMap }; });

  const lockedChecklist = new Set<number>();
  issues.forEach((issue) => issue.checklistQuestions.forEach((item) => { if (item.locked) { const value = parseNumber(item.number, 'CL'); if (value) lockedChecklist.add(value); } }));
  const usedChecklist = new Set<number>();
  issues.forEach((issue) => issue.checklistQuestions.forEach((item) => {
    if (item.locked && parseNumber(item.number, 'CL')) return;
    item.number = `CL-${padded(nextAvailable(lockedChecklist, usedChecklist))}`;
  }));

  return issues.map(syncLegacyFields);
}

export function syncLegacyFields<T extends SlrIssueLike & SlrChildFields>(issue: T): T {
  const activeRbbs = issue.recommendBaseBids.flatMap((rbb) => rbb.selectedSystems.map((system) => rbb.sections[system]).filter(Boolean))
    .filter((section) => section.status === 'Current' || section.status === 'Confirmed');
  const recommendations: Record<string, string> = {};
  activeRbbs.forEach((section) => {
    if (!text(section.recommendation)) return;
    recommendations[section.system] = recommendations[section.system]
      ? `${recommendations[section.system]}\n\n${section.recommendation}`
      : section.recommendation;
  });
  issue.recommendations = recommendations;
  issue.basis = Object.values(recommendations)[0] || '';

  const primaryRfi = issue.rfis.find((rfi) => rfi.includeInFormalRfi && text(rfi.question)) || issue.rfis[0];
  issue.rfi = primaryRfi?.number || '';
  issue.rfiQuestion = primaryRfi?.question || '';
  issue.formalRfi = issue.rfis.some((rfi) => rfi.includeInFormalRfi && text(rfi.question));
  if (primaryRfi?.response && !text(issue.resolution)) issue.resolution = primaryRfi.response;

  const checklistItems: Record<string, string> = {};
  issue.checklistQuestions.forEach((item) => {
    if (!text(item.question) || !text(item.system)) return;
    checklistItems[item.system] = checklistItems[item.system] ? `${checklistItems[item.system]}\n\n${item.question}` : item.question;
  });
  issue.checklistItems = checklistItems;
  issue.checklistItem = Object.values(checklistItems)[0] || '';
  issue.checklist = issue.checklistQuestions.some((item) => text(item.question));
  return issue;
}

export function recommendBaseBidSummary(issueSource: SlrIssueLike, includeDraft = false): string {
  const issue = normalizeLegacyChildren(issueSource);
  const lines: string[] = [];
  issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {
    const section = rbb.sections[system];
    if (!section || !text(section.recommendation)) return;
    if (!includeDraft && !['Current', 'Confirmed'].includes(section.status)) return;
    const systemLabel = system === 'Other' ? text(issue.customSystem) || 'Other' : system;
    lines.push(`${systemLabel}\n${section.recommendation}`);
  }));
  return lines.join('\n\n');
}

export function associatedClarificationNumbers(issueSource: SlrIssueLike): string[] {
  const issue = normalizeLegacyChildren(issueSource);
  const values: string[] = [];
  issue.rfis.forEach((rfi) => { if (text(rfi.number) && text(rfi.question) && (rfi.locked || rfi.status !== 'Draft')) values.push(`${rfi.number} — ${rfi.status}`); });
  issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {
    const section = rbb.sections[system];
    const customerReady = Boolean(section && text(section.recommendation) && ['Current', 'Confirmed'].includes(section.status));
    const historical = Boolean(section && (section.locked || section.contentReleased));
    if (section?.displayNumber && (customerReady || historical)) values.push(`${section.displayNumber} — ${section.status}`);
  }));
  return values;
}

export function rfiChildrenForDeliverable(issueSource: SlrIssueLike): SlrRfiChild[] {
  return normalizeLegacyChildren(issueSource).rfis.filter((rfi) => rfi.includeInFormalRfi && text(rfi.question));
}

export function checklistChildrenForDeliverable(issueSource: SlrIssueLike): SlrChecklistChild[] {
  return normalizeLegacyChildren(issueSource).checklistQuestions.filter((item) => text(item.system) && text(item.question));
}

export function lockIssuesForOfficialRelease<T extends SlrIssueLike>(sources: T[], kinds: string[], releasedAt = new Date().toISOString()): Array<T & SlrChildFields> {
  const issues = normalizeProjectIssueNumbers(sources);
  const lockSlr = kinds.some((kind) => ['sow', 'clarifications', 'checklist'].includes(kind));
  const lockRfi = kinds.some((kind) => ['rfi', 'clarifications'].includes(kind));
  const lockRbb = kinds.some((kind) => ['sow', 'clarifications'].includes(kind));
  const lockChecklist = kinds.includes('checklist');

  issues.forEach((issue) => {
    if (lockSlr && ((kinds.includes('sow') && issue.sow) || (kinds.includes('clarifications') && issue.clarification) || (kinds.includes('checklist') && issue.checklistQuestions.length))) {
      issue.numberLocked = true;
      issue.numberReleasedAt ||= releasedAt;
    }
    if (lockRfi) issue.rfis.forEach((rfi) => {
      if (!text(rfi.question)) return;
      const releasingFormalRfi = kinds.includes('rfi') && rfi.includeInFormalRfi;
      const releasingClarification = kinds.includes('clarifications') && rfi.status !== 'Draft';
      if (!releasingFormalRfi && !releasingClarification) return;
      rfi.locked = true; rfi.releasedAt ||= releasedAt;
      if (releasingFormalRfi && rfi.status === 'Draft') rfi.status = 'Issued';
    });
    if (lockRbb) issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {
      const section = rbb.sections[system];
      if (!section || !text(section.recommendation) || !['Current', 'Confirmed'].includes(section.status)) return;
      section.locked = true; section.contentReleased = true; section.releasedAt ||= releasedAt;
    }));
    if (lockChecklist) issue.checklistQuestions.forEach((item) => {
      if (!text(item.question)) return;
      item.locked = true; item.releasedAt ||= releasedAt;
    });
    syncLegacyFields(issue);
  });
  return normalizeProjectIssueNumbers(issues);
}

export function supersedeRbbSection<T extends SlrIssueLike>(source: T, displayNumber: string, recommendation: string, basedOnRfiUid = ''): T & SlrChildFields {
  const issue = normalizeLegacyChildren(source);
  let target: SlrRbbSection | null = null;
  for (const rbb of issue.recommendBaseBids) {
    for (const system of rbb.selectedSystems) {
      const section = rbb.sections[system];
      if (section?.displayNumber === displayNumber) {
        target = section;
        break;
      }
    }
    if (target) break;
  }
  if (!target) throw new Error(`Could not find ${displayNumber}.`);
  if (!target.locked && !target.contentReleased) {
    target.recommendation = recommendation;
    target.status = 'Current';
    if (basedOnRfiUid && !target.basedOnRfiUids.includes(basedOnRfiUid)) target.basedOnRfiUids.push(basedOnRfiUid);
    return syncLegacyFields(issue);
  }

  target.status = 'Superseded';
  const replacement = blankRbbChild(target.system);
  replacement.forceSuffix = Boolean(target.suffix);
  const replacementSection = replacement.sections[target.system];
  replacementSection.suffix = target.suffix;
  replacementSection.recommendation = recommendation;
  replacementSection.supersedesNumber = target.displayNumber;
  replacementSection.basedOnRfiUids = basedOnRfiUid ? [basedOnRfiUid] : [];
  issue.recommendBaseBids.push(replacement);
  return syncLegacyFields(issue);
}

export function confirmRbbSection<T extends SlrIssueLike>(source: T, displayNumber: string, basedOnRfiUid = ''): T & SlrChildFields {
  const issue = normalizeLegacyChildren(source);
  issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {
    const section = rbb.sections[system];
    if (!section || section.displayNumber !== displayNumber) return;
    section.status = 'Confirmed';
    if (basedOnRfiUid && !section.basedOnRfiUids.includes(basedOnRfiUid)) section.basedOnRfiUids.push(basedOnRfiUid);
  }));
  return syncLegacyFields(issue);
}
