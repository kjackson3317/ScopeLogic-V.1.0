'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '../../lib/supabase/client';
import {
  STANDARD_CHECKLIST_TEMPLATE,
  STARTER_SLR_TEMPLATES,
  type ChecklistTemplateItem,
  type ReviewSourceType,
} from '../../lib/review-workflow-model';
import styles from './review-workflow-preview-v3.module.css';

export type PreviewEngagement = {
  id: string;
  legacyId: string;
  masterProjectId: string;
  clientName: string;
  label: string;
  type: string;
  status: string;
};

export type PreviewMasterProject = {
  id: string;
  projectNumber: string;
  name: string;
  location: string;
  status: string;
  revision: string;
  systems: string[];
  engagements: PreviewEngagement[];
};

type Props = { masters: PreviewMasterProject[]; userEmail: string };
type MainTab = 'review' | 'templates' | 'overview';
type ReviewTab = 'capture' | 'evidence';
export type ReviewAction = 'RFI' | 'GC Clarification' | 'Contractor Clarification' | 'ScopeLogic Clarification' | 'VE Potential';
type ResolutionChoice = 'new' | 'existing' | 'none';

type ReviewNote = {
  id: string;
  masterProjectId: string;
  system: string;
  topic: string;
  sourceType: ReviewSourceType;
  sourceReference: string;
  note: string;
  actions: ReviewAction[];
  disposition: 'Unreviewed' | 'No Action' | 'SLR' | 'Linked to SLR';
  linkedSlrUid?: string;
  createdAt: string;
  updatedAt: string;
};

type ExistingSlr = {
  uid: string;
  displayNumber: string;
  title: string;
  system: string;
};

type EvidenceGroup = {
  key: string;
  system: string;
  topic: string;
  notes: ReviewNote[];
  references: string;
};

type ActionDrafts = {
  rfi: string;
  rbb: string;
  gc: string;
  contractor: string;
  scopeLogic: string;
  ve: string;
};

type SavedSlr = {
  id: string;
  groupKey?: string;
  title: string;
  system: string;
  concern: string;
  references: string;
  activeActions: ReviewAction[];
  includeRbb: boolean;
  outputs: ActionDrafts;
  sourceNoteIds: string[];
  source: string;
  updatedAt: string;
};

type AppliedChecklistItem = ChecklistTemplateItem & { enabled: boolean };

type CaptureState = {
  system: string;
  topic: string;
  sourceType: ReviewSourceType;
  sourceReference: string;
  note: string;
  actions: ReviewAction[];
};

const SOURCE_TYPES: ReviewSourceType[] = ['Specification', 'Drawing', 'Addendum', 'Narrative', 'Meeting', 'Field', 'Other'];
const DEFAULT_SYSTEMS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const REVIEW_ACTIONS: ReviewAction[] = ['RFI', 'GC Clarification', 'Contractor Clarification', 'ScopeLogic Clarification', 'VE Potential'];
const blankOutputs = (): ActionDrafts => ({ rfi: '', rbb: '', gc: '', contractor: '', scopeLogic: '', ve: '' });
const storageKey = (masterId: string, suffix: string) => `scopelogic-review-preview-v3:${masterId}:${suffix}`;
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'internal' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

function actionTone(action: ReviewAction): 'neutral' | 'green' | 'amber' | 'blue' | 'internal' {
  if (action === 'RFI') return 'blue';
  if (action === 'VE Potential') return 'green';
  if (action === 'ScopeLogic Clarification') return 'internal';
  if (action === 'GC Clarification') return 'amber';
  return 'neutral';
}

function groupNotes(notes: ReviewNote[]): EvidenceGroup[] {
  const groups = new Map<string, EvidenceGroup>();
  for (const note of notes) {
    if (!note.topic.trim()) continue;
    const key = `${normalize(note.system)}::${normalize(note.topic)}`;
    const group = groups.get(key) || { key, system: note.system || 'Other', topic: note.topic, notes: [], references: '' };
    group.notes.push(note);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    notes: [...group.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    references: [...new Set(group.notes.map((note) => note.sourceReference.trim()).filter(Boolean))].join('; '),
  })).sort((a, b) => `${a.system} ${a.topic}`.localeCompare(`${b.system} ${b.topic}`, undefined, { numeric: true, sensitivity: 'base' }));
}

function uniqueActions(group: EvidenceGroup) {
  return REVIEW_ACTIONS.filter((action) => group.notes.some((note) => note.actions.includes(action)));
}

function groupStatus(group: EvidenceGroup, savedSlrs: SavedSlr[]) {
  if (savedSlrs.some((slr) => slr.groupKey === group.key)) return { label: 'SLR Draft', tone: 'green' as const };
  if (group.notes.every((note) => note.disposition === 'Linked to SLR')) return { label: 'Linked', tone: 'blue' as const };
  if (group.notes.every((note) => note.disposition === 'No Action')) return { label: 'Reviewed', tone: 'neutral' as const };
  return { label: 'Unresolved', tone: 'amber' as const };
}

function initialOutputs(group: EvidenceGroup, actions: ReviewAction[]): ActionDrafts {
  return {
    rfi: actions.includes('RFI') ? `Clarify the ${group.topic} requirements and resolve the conditions identified in the referenced contract documents.${group.references ? ` References: ${group.references}.` : ''}` : '',
    rbb: actions.includes('RFI') ? `Carry the more complete / conservative interpretation for ${group.topic} until clarification is received.` : '',
    gc: actions.includes('GC Clarification') ? `Confirm GC coordination and responsibility for ${group.topic}.` : '',
    contractor: actions.includes('Contractor Clarification') ? `Confirm the proposal includes the applicable ${group.topic} requirements identified in the contract documents.` : '',
    scopeLogic: actions.includes('ScopeLogic Clarification') ? `Resolve ScopeLogic's interpretation of ${group.topic} before issuing a customer-facing recommendation.` : '',
    ve: actions.includes('VE Potential') ? `Evaluate the identified ${group.topic} value-engineering opportunity while maintaining required performance and compliance.` : '',
  };
}

function ActionChecks({ value, onChange, compact = false }: { value: ReviewAction[]; onChange: (value: ReviewAction[]) => void; compact?: boolean }) {
  const toggle = (action: ReviewAction) => onChange(value.includes(action) ? value.filter((item) => item !== action) : [...value, action]);
  return <div className={compact ? styles.actionChecksCompact : styles.actionChecks}>
    {REVIEW_ACTIONS.map((action) => <label key={action}>
      <input type="checkbox" checked={value.includes(action)} onChange={() => toggle(action)} />
      <span>{action}</span>
    </label>)}
  </div>;
}

export default function ReviewWorkflowPreviewV3({ masters, userEmail }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [selectedMasterId, setSelectedMasterId] = useState(masters[0]?.id || '');
  const [mainTab, setMainTab] = useState<MainTab>('review');
  const [reviewTab, setReviewTab] = useState<ReviewTab>('capture');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [savedSlrs, setSavedSlrs] = useState<SavedSlr[]>([]);
  const [checklistItems, setChecklistItems] = useState<AppliedChecklistItem[]>([]);
  const [existingSlrs, setExistingSlrs] = useState<ExistingSlr[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [resolution, setResolution] = useState<ResolutionChoice>('new');
  const [linkTargetUid, setLinkTargetUid] = useState('');
  const [activeActions, setActiveActions] = useState<ReviewAction[]>([]);
  const [includeRbb, setIncludeRbb] = useState(false);
  const [slrTitle, setSlrTitle] = useState('');
  const [slrConcern, setSlrConcern] = useState('');
  const [slrReferences, setSlrReferences] = useState('');
  const [outputs, setOutputs] = useState<ActionDrafts>(blankOutputs());
  const [flash, setFlash] = useState('');
  const [capture, setCapture] = useState<CaptureState>({ system: '', topic: '', sourceType: 'Specification', sourceReference: '', note: '', actions: [] });

  const selectedMaster = masters.find((master) => master.id === selectedMasterId) || masters[0] || null;
  const availableSystems = useMemo(() => Array.from(new Set([...(selectedMaster?.systems || []), ...DEFAULT_SYSTEMS])), [selectedMaster]);
  const groups = useMemo(() => groupNotes(notes), [notes]);
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) || null;
  const topicSuggestions = useMemo(() => Array.from(new Set(notes.map((note) => note.topic.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [notes]);
  const relatedEvidence = useMemo(() => notes.filter((note) => normalize(note.system) === normalize(capture.system) && normalize(note.topic) === normalize(capture.topic) && capture.topic.trim()), [notes, capture.system, capture.topic]);
  const filteredMasters = masters.filter((master) => {
    const needle = search.trim().toLowerCase();
    return !needle || `${master.projectNumber} ${master.name} ${master.location} ${master.status}`.toLowerCase().includes(needle);
  });

  useEffect(() => {
    if (!selectedMaster) return;
    setNotes(loadLocal<ReviewNote[]>(storageKey(selectedMaster.id, 'notes'), []));
    setSavedSlrs(loadLocal<SavedSlr[]>(storageKey(selectedMaster.id, 'slrs'), []));
    const checklistKey = storageKey(selectedMaster.id, 'checklist');
    const storedChecklist = typeof window !== 'undefined' ? window.localStorage.getItem(checklistKey) : null;
    if (storedChecklist) {
      setChecklistItems(loadLocal<AppliedChecklistItem[]>(checklistKey, []));
    } else {
      const defaults = STANDARD_CHECKLIST_TEMPLATE.items.map((item) => ({ ...item, enabled: item.enabledByDefault }));
      setChecklistItems(defaults);
      saveLocal(checklistKey, defaults);
    }
    setSelectedGroupKey('');
    setResolution('new');
    setLinkTargetUid('');
    setCapture((current) => ({ ...current, system: selectedMaster.systems[0] || current.system || 'Structured Cabling' }));

    const engagementIds = selectedMaster.engagements.map((engagement) => engagement.id).filter(Boolean);
    if (!engagementIds.length) {
      setExistingSlrs([]);
      return;
    }
    let cancelled = false;
    void supabase.from('slr_entries')
      .select('legacy_uid,display_number,scope_item,system_name,project_id')
      .in('project_id', engagementIds)
      .order('sequence_number')
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data || []).map((row: any): ExistingSlr => ({
          uid: String(row.legacy_uid || ''),
          displayNumber: String(row.display_number || ''),
          title: String(row.scope_item || 'Untitled SLR'),
          system: String(row.system_name || 'Other'),
        }));
        setExistingSlrs(Array.from(new Map(rows.filter((row) => row.uid).map((row) => [row.uid, row])).values()));
      });
    return () => { cancelled = true; };
  }, [selectedMasterId, selectedMaster, supabase]);

  const persistNotes = (next: ReviewNote[]) => {
    setNotes(next);
    if (selectedMaster) saveLocal(storageKey(selectedMaster.id, 'notes'), next);
  };
  const persistSlrs = (next: SavedSlr[]) => {
    setSavedSlrs(next);
    if (selectedMaster) saveLocal(storageKey(selectedMaster.id, 'slrs'), next);
  };
  const persistChecklist = (next: AppliedChecklistItem[]) => {
    setChecklistItems(next);
    if (selectedMaster) saveLocal(storageKey(selectedMaster.id, 'checklist'), next);
  };

  const addNote = () => {
    if (!selectedMaster || !capture.topic.trim() || !capture.note.trim()) return;
    const now = new Date().toISOString();
    const next: ReviewNote = {
      id: crypto.randomUUID(),
      masterProjectId: selectedMaster.id,
      system: capture.system || 'Other',
      topic: capture.topic.trim(),
      sourceType: capture.sourceType,
      sourceReference: capture.sourceReference.trim(),
      note: capture.note.trim(),
      actions: [...capture.actions],
      disposition: 'Unreviewed',
      createdAt: now,
      updatedAt: now,
    };
    persistNotes([...notes, next]);
    setCapture((current) => ({ ...current, sourceReference: '', note: '', actions: [] }));
    setFlash('Captured. System, Topic, and Source stay selected so you can keep reading.');
  };

  const loadExample = () => {
    if (!selectedMaster) return;
    const now = new Date().toISOString();
    const sample: ReviewNote[] = [
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Copper Cabling Category', sourceType: 'Specification', sourceReference: '27 10 00 §2.3.A', note: 'Category 6A horizontal cabling is required.', actions: ['RFI', 'ScopeLogic Clarification', 'VE Potential'], disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Copper Cabling Category', sourceType: 'Drawing', sourceReference: 'T2.01 Note 7', note: 'Drawing note calls for Category 6 horizontal cabling.', actions: ['RFI'], disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Copper Cabling Category', sourceType: 'Drawing', sourceReference: 'T5.02 Detail 3', note: 'Category 6A is specifically called out for WAP locations.', actions: ['VE Potential'], disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Owner Training', sourceType: 'Specification', sourceReference: '27 05 00 §3.8', note: 'Four hours of owner training required.', actions: ['Contractor Clarification'], disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'MDF / IDF Coordination', sourceType: 'Drawing', sourceReference: 'T5.01 Detail 2', note: 'Rack placement coordination responsibility is not clear.', actions: ['GC Clarification'], disposition: 'Unreviewed', createdAt: now, updatedAt: now },
    ];
    persistNotes([...notes, ...sample]);
    setFlash('Example evidence loaded locally. Nothing was written to production.');
  };

  const openGroup = (group: EvidenceGroup) => {
    setSelectedGroupKey(group.key);
    const actions = uniqueActions(group);
    setActiveActions(actions);
    setIncludeRbb(actions.includes('RFI'));
    setResolution('new');
    setLinkTargetUid('');
    setSlrTitle(group.topic);
    setSlrConcern(group.notes.map((note) => `${note.sourceReference || note.sourceType}: ${note.note}`).join('\n'));
    setSlrReferences(group.references);
    setOutputs(initialOutputs(group, actions));
  };

  const markReviewed = () => {
    if (!selectedGroup) return;
    const ids = new Set(selectedGroup.notes.map((note) => note.id));
    persistNotes(notes.map((note) => ids.has(note.id) ? { ...note, disposition: 'No Action', updatedAt: new Date().toISOString() } : note));
    setFlash(`“${selectedGroup.topic}” marked reviewed with no SLR required.`);
  };

  const linkExisting = () => {
    if (!selectedGroup || !linkTargetUid) return;
    const ids = new Set(selectedGroup.notes.map((note) => note.id));
    persistNotes(notes.map((note) => ids.has(note.id) ? { ...note, disposition: 'Linked to SLR', linkedSlrUid: linkTargetUid, updatedAt: new Date().toISOString() } : note));
    const target = existingSlrs.find((slr) => slr.uid === linkTargetUid);
    setFlash(`Evidence linked locally to ${target?.displayNumber || 'the selected SLR'}. Production remains unchanged.`);
  };

  const saveSlr = () => {
    if (!selectedGroup || !slrTitle.trim()) return;
    const now = new Date().toISOString();
    const draft: SavedSlr = {
      id: savedSlrs.find((slr) => slr.groupKey === selectedGroup.key)?.id || crypto.randomUUID(),
      groupKey: selectedGroup.key,
      title: slrTitle.trim(),
      system: selectedGroup.system,
      concern: slrConcern.trim(),
      references: slrReferences.trim(),
      activeActions: [...activeActions],
      includeRbb,
      outputs: { ...outputs },
      sourceNoteIds: selectedGroup.notes.map((note) => note.id),
      source: 'Review Evidence',
      updatedAt: now,
    };
    persistSlrs([draft, ...savedSlrs.filter((slr) => slr.groupKey !== selectedGroup.key)]);
    const ids = new Set(draft.sourceNoteIds);
    persistNotes(notes.map((note) => ids.has(note.id) ? { ...note, disposition: 'SLR', updatedAt: now } : note));
    setFlash(`SLR draft “${draft.title}” saved inline. Nothing was published to the live Internal Matrix.`);
  };

  const useTemplate = (templateId: string) => {
    const template = STARTER_SLR_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const now = new Date().toISOString();
    const actions: ReviewAction[] = [
      ...(template.defaultRfi ? ['RFI' as ReviewAction] : []),
      ...(template.defaultChecklist ? ['Contractor Clarification' as ReviewAction] : []),
    ];
    const draft: SavedSlr = {
      id: crypto.randomUUID(),
      title: template.name,
      system: template.system,
      concern: template.defaultConcern,
      references: '',
      activeActions: actions,
      includeRbb: Boolean(template.defaultRfi),
      outputs: { ...blankOutputs(), rfi: template.defaultRfi || '', contractor: template.defaultChecklist || '' },
      sourceNoteIds: [],
      source: `SLR Template — ${template.name}`,
      updatedAt: now,
    };
    persistSlrs([draft, ...savedSlrs]);
    setFlash(`Template “${template.name}” added as a local SLR draft for editing. It was not published.`);
  };

  const clearPreview = () => {
    if (!selectedMaster || typeof window === 'undefined') return;
    ['notes', 'slrs', 'checklist'].forEach((suffix) => window.localStorage.removeItem(storageKey(selectedMaster.id, suffix)));
    setNotes([]);
    setSavedSlrs([]);
    const defaults = STANDARD_CHECKLIST_TEMPLATE.items.map((item) => ({ ...item, enabled: item.enabledByDefault }));
    setChecklistItems(defaults);
    saveLocal(storageKey(selectedMaster.id, 'checklist'), defaults);
    setSelectedGroupKey('');
    setFlash('Preview data cleared. Standard Contractor Clarifications were restored because that template is default-on.');
  };

  if (!selectedMaster) return <main className={styles.empty}><h1>Review Workflow Preview</h1><p>No active Master Projects are available.</p></main>;

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><img src="/brand/scopelogic-logo-mark.png" alt="" /><div><b>ScopeLogic</b><span>Review Workflow Test</span></div></div>
      <div className={styles.libraryTitle}><span>MASTER PROJECT LIBRARY</span><b>Master Projects</b><small>Single project-level library</small></div>
      <input className={styles.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search master projects…" />
      <div className={styles.masterList}>{filteredMasters.map((master) => <button key={master.id} className={master.id === selectedMaster.id ? styles.masterActive : ''} onClick={() => setSelectedMasterId(master.id)}><span>{master.projectNumber || 'MASTER'}</span><b>{master.name}</b><small>{master.status} · {master.engagements.length} engagement{master.engagements.length === 1 ? '' : 's'}</small></button>)}</div>
      <div className={styles.sidebarFooter}><span>{userEmail}</span><a href="/master-projects">Current Master Project Manager</a></div>
    </aside>

    <main className={styles.main}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>MASTER PROJECT · {selectedMaster.projectNumber}</span><h1>{selectedMaster.name}</h1><p>{selectedMaster.location || 'No location entered'} · {selectedMaster.revision}</p></div>
        <div className={styles.headerBadges}><Badge tone="green">{selectedMaster.status}</Badge><Badge tone="blue">TEST ONLY — local preview writes</Badge></div>
      </header>

      <nav className={styles.tabs}>
        <button className={mainTab === 'review' ? styles.tabActive : ''} onClick={() => setMainTab('review')}>Document Review</button>
        <button className={mainTab === 'templates' ? styles.tabActive : ''} onClick={() => setMainTab('templates')}>Templates</button>
        <button className={mainTab === 'overview' ? styles.tabActive : ''} onClick={() => setMainTab('overview')}>Overview</button>
        <button className={styles.clearButton} onClick={clearPreview}>Clear Preview Data</button>
      </nav>

      {flash && <div className={styles.flash}><span>{flash}</span><button onClick={() => setFlash('')}>×</button></div>}

      {mainTab === 'review' && <>
        <div className={styles.workflowStrip}>
          <div><span>1</span><b>Capture</b><small>Record what you see</small></div><i>→</i>
          <div><span>2</span><b>Group</b><small>System + Topic</small></div><i>→</i>
          <div><span>3</span><b>Resolve</b><small>No action · Existing SLR · New SLR</small></div>
        </div>
        <div className={styles.subtabs}>
          <button className={reviewTab === 'capture' ? styles.subtabActive : ''} onClick={() => setReviewTab('capture')}>Capture <Badge>{notes.length}</Badge></button>
          <button className={reviewTab === 'evidence' ? styles.subtabActive : ''} onClick={() => setReviewTab('evidence')}>Evidence Groups <Badge>{groups.length}</Badge></button>
        </div>

        {reviewTab === 'capture' && <>
          <div className={styles.captureLayout}>
            <section className={styles.panel}>
              <div className={styles.panelHead}><div><span>Review mode</span><h2>Quick Capture</h2></div><div className={styles.buttonRow}><button className={styles.secondary} onClick={loadExample}>Load Example</button><button className={styles.primary} disabled={!capture.topic.trim() || !capture.note.trim()} onClick={addNote}>Save & New</button></div></div>
              <p className={styles.help}>System, Topic, and Source stay selected after Save & New. Action flags are optional; capture first and decide later when needed.</p>
              <div className={styles.captureGrid}>
                <label><span>System</span><select value={capture.system} onChange={(event) => setCapture({ ...capture, system: event.target.value })}>{availableSystems.map((system) => <option key={system}>{system}</option>)}</select></label>
                <label><span>Topic</span><input list="review-topic-suggestions" value={capture.topic} onChange={(event) => setCapture({ ...capture, topic: event.target.value })} placeholder="Start typing or reuse a project topic…" /><datalist id="review-topic-suggestions">{topicSuggestions.map((topic) => <option key={topic} value={topic} />)}</datalist></label>
                <label><span>Source</span><select value={capture.sourceType} onChange={(event) => setCapture({ ...capture, sourceType: event.target.value as ReviewSourceType })}>{SOURCE_TYPES.map((source) => <option key={source}>{source}</option>)}</select></label>
                <label><span>Reference</span><input value={capture.sourceReference} onChange={(event) => setCapture({ ...capture, sourceReference: event.target.value })} placeholder="27 10 00 §2.3.A or T2.01 N7" /></label>
                <label className={styles.span2}><span>Observation</span><textarea value={capture.note} onChange={(event) => setCapture({ ...capture, note: event.target.value })} placeholder="What does the document say? Keep this factual enough to make sense later." /></label>
              </div>
              <div className={styles.optionalActions}><div><b>Potential Actions</b><span>Optional — do not stop your review just to classify something.</span></div><ActionChecks value={capture.actions} onChange={(actions) => setCapture({ ...capture, actions })} compact /></div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}><div><span>Context while capturing</span><h2>Related Evidence</h2></div><Badge tone={relatedEvidence.length ? 'green' : 'neutral'}>{relatedEvidence.length} existing</Badge></div>
              <p className={styles.help}>As soon as System + Topic match a prior note, it appears here. This is intended to stop the backtracking problem while you move through specs and drawings.</p>
              <div className={styles.relatedList}>{relatedEvidence.length ? relatedEvidence.map((note) => <article key={note.id}><div><Badge tone={note.sourceType === 'Drawing' ? 'blue' : note.sourceType === 'Specification' ? 'green' : 'neutral'}>{note.sourceType}</Badge><b>{note.sourceReference || 'No reference'}</b></div><p>{note.note}</p></article>) : <div className={styles.emptyState}>{capture.topic.trim() ? 'No earlier evidence for this System + Topic yet.' : 'Choose or type a Topic to see related evidence while you work.'}</div>}</div>
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Current review notebook</span><h2>Captured Notes</h2></div><button className={styles.secondary} disabled={!notes.length} onClick={() => setReviewTab('evidence')}>Resolve Evidence Groups</button></div>
            {notes.length ? <div className={styles.tableWrap}><table className={styles.notesTable}><thead><tr><th>System</th><th>Topic</th><th>Source</th><th>Reference</th><th>Observation</th><th>Flags</th><th></th></tr></thead><tbody>{[...notes].reverse().map((note) => <tr key={note.id}><td>{note.system}</td><td><b>{note.topic}</b></td><td>{note.sourceType}</td><td>{note.sourceReference || '—'}</td><td>{note.note}</td><td><div className={styles.flagStack}>{note.actions.map((action) => <Badge key={action} tone={actionTone(action)}>{action}</Badge>)}</div></td><td><button className={styles.removeButton} onClick={() => persistNotes(notes.filter((item) => item.id !== note.id))}>×</button></td></tr>)}</tbody></table></div> : <div className={styles.emptyState}>No notes yet. Capture facts quickly as you move through the document set.</div>}
          </section>
        </>}

        {reviewTab === 'evidence' && <div className={styles.evidenceLayout}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Synthesis queue</span><h2>Evidence Groups</h2></div><Badge tone="green">System + Topic</Badge></div>
            <div className={styles.groupList}>{groups.length ? groups.map((group) => {
              const status = groupStatus(group, savedSlrs);
              return <button key={group.key} className={selectedGroupKey === group.key ? styles.groupActive : ''} onClick={() => openGroup(group)}><div><span>{group.system}</span><b>{group.topic}</b><small>{group.notes.length} note{group.notes.length === 1 ? '' : 's'} · {group.references || 'No references'}</small></div><Badge tone={status.tone}>{status.label}</Badge></button>;
            }) : <div className={styles.emptyState}>No evidence groups yet.</div>}</div>
            {savedSlrs.length > 0 && <div className={styles.savedSubjects}><h3>Local SLR Subject Records</h3>{savedSlrs.map((slr) => <div key={slr.id}><span>{slr.system}</span><b>{slr.title}</b><small>{slr.source}</small></div>)}</div>}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Resolve this subject</span><h2>{selectedGroup?.topic || 'Select an Evidence Group'}</h2></div>{selectedGroup && <Badge>{selectedGroup.notes.length} evidence item{selectedGroup.notes.length === 1 ? '' : 's'}</Badge>}</div>
            {selectedGroup ? <>
              <div className={styles.evidenceStack}>{selectedGroup.notes.map((note) => <article key={note.id}><div><Badge tone={note.sourceType === 'Drawing' ? 'blue' : note.sourceType === 'Specification' ? 'green' : 'neutral'}>{note.sourceType}</Badge><b>{note.sourceReference || 'No reference'}</b></div><p>{note.note}</p><div className={styles.flagStack}>{note.actions.map((action) => <Badge key={action} tone={actionTone(action)}>{action}</Badge>)}</div></article>)}</div>

              <div className={styles.resolutionChooser}>
                <label><input type="radio" name="resolution" checked={resolution === 'none'} onChange={() => setResolution('none')} /><span><b>No further action</b><small>Evidence reviewed; no SLR is needed.</small></span></label>
                <label><input type="radio" name="resolution" checked={resolution === 'existing'} onChange={() => setResolution('existing')} /><span><b>Add to existing SLR</b><small>Keep one durable subject record.</small></span></label>
                <label><input type="radio" name="resolution" checked={resolution === 'new'} onChange={() => setResolution('new')} /><span><b>Create new SLR</b><small>Synthesize this evidence into a subject record.</small></span></label>
              </div>

              {resolution === 'none' && <div className={styles.resolveBox}><p>No customer-facing output is created. The evidence remains in the project review history.</p><button className={styles.primary} onClick={markReviewed}>Mark Reviewed</button></div>}

              {resolution === 'existing' && <div className={styles.resolveBox}><label><span>Existing SLR</span><select value={linkTargetUid} onChange={(event) => setLinkTargetUid(event.target.value)}><option value="">Select SLR…</option>{existingSlrs.map((slr) => <option key={slr.uid} value={slr.uid}>{slr.displayNumber} — {slr.title}</option>)}</select></label><button className={styles.primary} disabled={!linkTargetUid} onClick={linkExisting}>Link Evidence</button></div>}

              {resolution === 'new' && <div className={styles.synthesisBox}>
                <div className={styles.synthesisHeader}><div><span>SLR SUBJECT RECORD</span><b>Evidence becomes the basis; the SLR becomes the conclusion.</b></div><ActionChecks value={activeActions} onChange={(actions) => { setActiveActions(actions); if (!actions.includes('RFI')) setIncludeRbb(false); }} compact /></div>
                <label><span>SLR Title</span><input value={slrTitle} onChange={(event) => setSlrTitle(event.target.value)} /></label>
                <label><span>Scope Concern / Consolidated Finding</span><textarea value={slrConcern} onChange={(event) => setSlrConcern(event.target.value)} /></label>
                <label><span>Supporting References</span><input value={slrReferences} onChange={(event) => setSlrReferences(event.target.value)} /></label>
                {activeActions.includes('RFI') && <label><span>RFI</span><textarea value={outputs.rfi} onChange={(event) => setOutputs({ ...outputs, rfi: event.target.value })} /></label>}
                {activeActions.includes('RFI') && <label className={styles.rbbToggle}><input type="checkbox" checked={includeRbb} onChange={(event) => setIncludeRbb(event.target.checked)} /><span><b>Recommended Base Bid</b>Carry an RBB while the RFI is unresolved.</span></label>}
                {includeRbb && <label><span>Recommended Base Bid</span><textarea value={outputs.rbb} onChange={(event) => setOutputs({ ...outputs, rbb: event.target.value })} /></label>}
                {activeActions.includes('GC Clarification') && <label><span>GC Clarification</span><textarea value={outputs.gc} onChange={(event) => setOutputs({ ...outputs, gc: event.target.value })} /></label>}
                {activeActions.includes('Contractor Clarification') && <label><span>Contractor Clarification</span><textarea value={outputs.contractor} onChange={(event) => setOutputs({ ...outputs, contractor: event.target.value })} /></label>}
                {activeActions.includes('ScopeLogic Clarification') && <div className={styles.internalBlock}><label><span>ScopeLogic Clarification — Internal</span><textarea value={outputs.scopeLogic} onChange={(event) => setOutputs({ ...outputs, scopeLogic: event.target.value })} /></label></div>}
                {activeActions.includes('VE Potential') && <label><span>VE Potential</span><textarea value={outputs.ve} onChange={(event) => setOutputs({ ...outputs, ve: event.target.value })} /></label>}
                <div className={styles.buttonRow}><button className={styles.primary} onClick={saveSlr}>Save SLR Draft</button><small>Inline draft only. Production publishing remains disabled.</small></div>
              </div>}
            </> : <div className={styles.emptyState}>Select a grouped subject. You should be able to resolve it without navigating to a separate SLR Drafts screen.</div>}
          </section>
        </div>}
      </>}

      {mainTab === 'templates' && <div className={styles.pageGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>Default-on project confirmations</span><h2>Contractor Clarification Template</h2></div><Badge tone="green">Auto-applied</Badge></div>
          <p className={styles.help}>ScopeLogic Standard is selected by default for every Master Project in this preview. Remove anything that does not apply instead of rebuilding routine confirmations every time.</p>
          <div className={styles.templateSelect}><span>Project Template</span><b>{STANDARD_CHECKLIST_TEMPLATE.name}</b></div>
          <div className={styles.checklist}>{checklistItems.map((item, index) => <label key={item.id}><input type="checkbox" checked={item.enabled} onChange={(event) => persistChecklist(checklistItems.map((current, currentIndex) => currentIndex === index ? { ...current, enabled: event.target.checked } : current))} /><span><b>{item.category}</b>{item.question}</span></label>)}</div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>Opt-in recurring subjects</span><h2>SLR Templates</h2></div><Badge>Use only when applicable</Badge></div>
          <p className={styles.help}>These preload recurring issue language. They do not automatically become project SLRs.</p>
          <div className={styles.slrTemplates}>{STARTER_SLR_TEMPLATES.map((template) => <article key={template.id}><div><Badge>{template.system}</Badge><b>{template.name}</b></div><p>{template.whenToUse}</p><button className={styles.secondary} onClick={() => useTemplate(template.id)}>Start SLR from Template</button></article>)}</div>
        </section>
      </div>}

      {mainTab === 'overview' && <div className={styles.pageGrid}>
        <section className={styles.panel}><div className={styles.panelHead}><div><span>Project hierarchy</span><h2>Master Project is the project library</h2></div><Badge tone="green">Proposed</Badge></div><p className={styles.help}>Quotes and Client Engagements remain children of the Master Project. The redundant standalone Project Library is not part of this proposed workflow.</p>{selectedMaster.engagements.map((engagement) => <div key={engagement.id} className={styles.engagement}><div><b>{engagement.clientName || 'Unassigned client'}</b><span>{engagement.label} · {engagement.type || 'Service not set'}</span></div><Badge>{engagement.status}</Badge></div>)}</section>
        <section className={styles.panel}><div className={styles.panelHead}><div><span>Test target</span><h2>What this version is testing</h2></div></div><div className={styles.testPoints}><p><b>1.</b> Can you capture notes without breaking reading flow?</p><p><b>2.</b> Does related evidence stop unnecessary doubling back?</p><p><b>3.</b> Are grouped subjects easy to resolve?</p><p><b>4.</b> Does inline SLR creation feel better than a separate Drafts stage?</p><p><b>5.</b> Are RFI, GC, Contractor, ScopeLogic and VE the right action lanes?</p></div></section>
      </div>}
    </main>
  </div>;
}
