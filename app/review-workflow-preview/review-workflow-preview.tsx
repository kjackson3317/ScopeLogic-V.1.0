'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import {
  STANDARD_CHECKLIST_TEMPLATE,
  STARTER_SLR_TEMPLATES,
  buildSlrDraftFromEvidence,
  groupReviewNotes,
  reviewGroupRecommendation,
  type ChecklistTemplateItem,
  type EvidenceGroup,
  type ReviewNote,
  type ReviewSourceType,
  type ReviewSlrDraft,
} from '../../lib/review-workflow-model';
import styles from './review-workflow-preview.module.css';

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
type MainTab = 'overview' | 'review' | 'templates' | 'drafts';
type ReviewTab = 'capture' | 'evidence';

type ExistingSlr = {
  uid: string;
  displayNumber: string;
  title: string;
  system: string;
};

type AddressDraft = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
};

type StagedSlr = ReviewSlrDraft & { id: string; createdAt: string; source: string };

type AppliedChecklistItem = ChecklistTemplateItem & { enabled: boolean };

const SOURCE_TYPES: ReviewSourceType[] = ['Specification', 'Drawing', 'Addendum', 'Narrative', 'Meeting', 'Field', 'Other'];
const DEFAULT_SYSTEMS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];

const blankAddress = (): AddressDraft => ({ address1: '', address2: '', city: '', state: '', zip: '' });
const storageKey = (masterId: string, suffix: string) => `scopelogic-review-preview:${masterId}:${suffix}`;

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatAddress(address: AddressDraft) {
  const street = [address.address1, address.address2].filter(Boolean).join(', ');
  const cityLine = [address.city, address.state, address.zip].filter(Boolean).join(' ');
  return [street, cityLine].filter(Boolean).join(' · ');
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

export default function ReviewWorkflowPreview({ masters, userEmail }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [selectedMasterId, setSelectedMasterId] = useState(masters[0]?.id || '');
  const [mainTab, setMainTab] = useState<MainTab>('review');
  const [reviewTab, setReviewTab] = useState<ReviewTab>('capture');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [address, setAddress] = useState<AddressDraft>(blankAddress());
  const [stagedSlrs, setStagedSlrs] = useState<StagedSlr[]>([]);
  const [checklistItems, setChecklistItems] = useState<AppliedChecklistItem[]>([]);
  const [existingSlrs, setExistingSlrs] = useState<ExistingSlr[]>([]);
  const [selectedEvidenceKey, setSelectedEvidenceKey] = useState('');
  const [slrDraft, setSlrDraft] = useState<ReviewSlrDraft | null>(null);
  const [linkTargetUid, setLinkTargetUid] = useState('');
  const [flash, setFlash] = useState('');
  const [capture, setCapture] = useState({ system: '', topic: '', sourceType: 'Specification' as ReviewSourceType, sourceReference: '', note: '' });

  const selectedMaster = masters.find((master) => master.id === selectedMasterId) || masters[0] || null;
  const availableSystems = useMemo(() => {
    const masterSystems = selectedMaster?.systems || [];
    return Array.from(new Set([...masterSystems, ...DEFAULT_SYSTEMS]));
  }, [selectedMaster]);

  useEffect(() => {
    if (!selectedMaster) return;
    setNotes(loadLocal<ReviewNote[]>(storageKey(selectedMaster.id, 'notes'), []));
    setAddress(loadLocal<AddressDraft>(storageKey(selectedMaster.id, 'address'), blankAddress()));
    setStagedSlrs(loadLocal<StagedSlr[]>(storageKey(selectedMaster.id, 'staged-slrs'), []));
    setChecklistItems(loadLocal<AppliedChecklistItem[]>(storageKey(selectedMaster.id, 'checklist'), []));
    setSelectedEvidenceKey('');
    setSlrDraft(null);
    setLinkTargetUid('');
    setCapture((current) => ({ ...current, system: selectedMaster.systems[0] || current.system || 'Structured Cabling' }));

    const engagementIds = selectedMaster.engagements.map((engagement) => engagement.id).filter(Boolean);
    if (!engagementIds.length) {
      setExistingSlrs([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from('slr_entries')
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
  const persistAddress = (next: AddressDraft) => {
    setAddress(next);
    if (selectedMaster) saveLocal(storageKey(selectedMaster.id, 'address'), next);
  };
  const persistStagedSlrs = (next: StagedSlr[]) => {
    setStagedSlrs(next);
    if (selectedMaster) saveLocal(storageKey(selectedMaster.id, 'staged-slrs'), next);
  };
  const persistChecklist = (next: AppliedChecklistItem[]) => {
    setChecklistItems(next);
    if (selectedMaster) saveLocal(storageKey(selectedMaster.id, 'checklist'), next);
  };

  const evidenceGroups = useMemo(() => groupReviewNotes(notes), [notes]);
  const selectedEvidence = evidenceGroups.find((group) => group.key === selectedEvidenceKey) || null;
  const filteredMasters = masters.filter((master) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${master.projectNumber} ${master.name} ${master.location} ${master.status} ${master.engagements.map((item) => item.clientName).join(' ')}`.toLowerCase().includes(needle);
  });

  const addReviewNote = () => {
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
      disposition: 'Unreviewed',
      createdAt: now,
      updatedAt: now,
    };
    persistNotes([...notes, next]);
    setCapture((current) => ({ ...current, sourceReference: '', note: '' }));
    setFlash('Review note captured. Topic and system stay selected so you can continue reviewing without re-entering them.');
  };

  const loadExampleReview = () => {
    if (!selectedMaster) return;
    const now = new Date().toISOString();
    const sample: ReviewNote[] = [
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Copper Cabling Category', sourceType: 'Specification', sourceReference: '27 10 00 §2.3.A', note: 'Specification requires Category 6A for horizontal cabling.', disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Copper Cabling Category', sourceType: 'Drawing', sourceReference: 'T2.01 Note 7', note: 'Drawing note calls for Category 6 cable.', disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Copper Cabling Category', sourceType: 'Drawing', sourceReference: 'T5.02 Detail 3', note: 'Detail specifically calls for Category 6A at WAP locations.', disposition: 'Unreviewed', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), masterProjectId: selectedMaster.id, system: 'Structured Cabling', topic: 'Owner Training', sourceType: 'Specification', sourceReference: '27 05 00 §3.8', note: 'Provide four hours of owner training.', disposition: 'Unreviewed', createdAt: now, updatedAt: now },
    ];
    persistNotes([...notes, ...sample]);
    setReviewTab('evidence');
    setFlash('Sample review notes added locally for this preview only.');
  };

  const removeNote = (id: string) => persistNotes(notes.filter((note) => note.id !== id));

  const openEvidence = (group: EvidenceGroup) => {
    setSelectedEvidenceKey(group.key);
    setSlrDraft(buildSlrDraftFromEvidence(group));
    setLinkTargetUid('');
  };

  const stageEvidenceAsSlr = () => {
    if (!slrDraft || !selectedEvidence) return;
    const next: StagedSlr = { ...slrDraft, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: 'Review Evidence' };
    persistStagedSlrs([next, ...stagedSlrs]);
    const sourceIds = new Set(slrDraft.sourceNoteIds);
    persistNotes(notes.map((note) => sourceIds.has(note.id) ? { ...note, disposition: 'SLR', updatedAt: new Date().toISOString() } : note));
    setFlash(`Staged “${next.title}” as an SLR draft. Nothing was written to the live Internal Matrix.`);
    setMainTab('drafts');
  };

  const linkEvidenceToExistingSlr = () => {
    if (!selectedEvidence || !linkTargetUid) return;
    const sourceIds = new Set(selectedEvidence.notes.map((note) => note.id));
    persistNotes(notes.map((note) => sourceIds.has(note.id) ? { ...note, disposition: 'Linked to SLR', linkedSlrUid: linkTargetUid, updatedAt: new Date().toISOString() } : note));
    const target = existingSlrs.find((item) => item.uid === linkTargetUid);
    setFlash(`Evidence linked locally to ${target?.displayNumber || 'the selected SLR'} for preview. Production linkage will append these references without retyping the SLR.`);
  };

  const applyChecklistTemplate = () => {
    const next = STANDARD_CHECKLIST_TEMPLATE.items.map((item) => ({ ...item, enabled: item.enabledByDefault }));
    persistChecklist(next);
    setFlash('Standard checklist copied into this project draft. These are project-specific copies; editing them will not change the global template.');
  };

  const useSlrTemplate = (templateId: string) => {
    const template = STARTER_SLR_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const draft: StagedSlr = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      source: `SLR Template — ${template.name}`,
      title: template.name,
      system: template.system,
      systems: [template.system],
      concern: template.defaultConcern,
      reference: '',
      sourceType: '',
      sourceNoteIds: [],
    };
    persistStagedSlrs([draft, ...stagedSlrs]);
    setFlash(`Template “${template.name}” staged for project-specific editing. It was not automatically made an SLR.`);
    setMainTab('drafts');
  };

  if (!selectedMaster) {
    return <main className={styles.empty}><h1>Review Workflow Preview</h1><p>No active Master Projects are available.</p><a href="/master-projects">Return to Master Projects</a></main>;
  }

  const addressDisplay = formatAddress(address) || selectedMaster.location || 'No project address entered';

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><img src="/brand/scopelogic-logo-mark.png" alt="" /><div><b>ScopeLogic</b><span>Workflow Preview</span></div></div>
      <div className={styles.libraryTitle}><span>PROJECT LIBRARY</span><b>Master Projects</b><small>Single project-level library</small></div>
      <input className={styles.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search master projects…" />
      <div className={styles.masterList}>{filteredMasters.map((master) => <button key={master.id} className={master.id === selectedMaster.id ? styles.masterActive : ''} onClick={() => setSelectedMasterId(master.id)}><span>{master.projectNumber || 'MASTER'}</span><b>{master.name}</b><small>{master.engagements.length} engagement{master.engagements.length === 1 ? '' : 's'} · {master.status}</small></button>)}</div>
      <div className={styles.sidebarFooter}><span>{userEmail}</span><a href="/master-projects">Current Master Project Manager</a></div>
    </aside>

    <main className={styles.main}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>MASTER PROJECT · {selectedMaster.projectNumber}</span><h1>{selectedMaster.name}</h1><p>{addressDisplay}</p></div>
        <div className={styles.headerBadges}><Badge tone="green">{selectedMaster.status}</Badge><Badge>{selectedMaster.revision}</Badge><Badge tone="blue">Preview only — no production writes</Badge></div>
      </header>

      <nav className={styles.tabs}>
        {([['overview', 'Overview'], ['review', 'Document Review'], ['templates', 'Templates'], ['drafts', `SLR Drafts${stagedSlrs.length ? ` (${stagedSlrs.length})` : ''}`]] as Array<[MainTab, string]>).map(([key, label]) => <button key={key} className={mainTab === key ? styles.tabActive : ''} onClick={() => setMainTab(key)}>{label}</button>)}
      </nav>

      {flash && <div className={styles.flash}><span>{flash}</span><button onClick={() => setFlash('')}>×</button></div>}

      {mainTab === 'overview' && <div className={styles.pageGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>Project setup</span><h2>Optional Project Address</h2></div><Badge>None required</Badge></div>
          <p className={styles.help}>The Master Project carries the physical project address. Each field is optional; ScopeLogic formats only the fields you enter.</p>
          <div className={styles.addressGrid}>
            <label className={styles.span2}><span>Address Line 1</span><input value={address.address1} onChange={(event) => persistAddress({ ...address, address1: event.target.value })} placeholder="Street address" /></label>
            <label className={styles.span2}><span>Address Line 2</span><input value={address.address2} onChange={(event) => persistAddress({ ...address, address2: event.target.value })} placeholder="Suite, building, campus, etc." /></label>
            <label><span>City</span><input value={address.city} onChange={(event) => persistAddress({ ...address, city: event.target.value })} /></label>
            <label><span>State</span><input value={address.state} onChange={(event) => persistAddress({ ...address, state: event.target.value })} placeholder="GA" /></label>
            <label><span>ZIP / Postal Code</span><input value={address.zip} onChange={(event) => persistAddress({ ...address, zip: event.target.value })} /></label>
          </div>
          <div className={styles.previewLine}><span>Formatted location</span><b>{formatAddress(address) || '—'}</b></div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>Project hierarchy</span><h2>Client Engagements & Quotes</h2></div><Badge tone="green">Under Master Project</Badge></div>
          <p className={styles.help}>The old standalone Project Library is removed from the proposed navigation. Client-specific work remains an engagement inside this Master Project.</p>
          <div className={styles.engagementList}>{selectedMaster.engagements.length ? selectedMaster.engagements.map((engagement) => <div key={engagement.id} className={styles.engagementRow}><div><b>{engagement.clientName || 'Unassigned client'}</b><span>{engagement.label} · {engagement.type || 'Service not set'}</span></div><Badge>{engagement.status}</Badge><button disabled title="Preview only">Quotes / Deliverables</button></div>) : <div className={styles.emptyState}>No Client Engagements yet.</div>}</div>
        </section>
      </div>}

      {mainTab === 'review' && <>
        <div className={styles.workflowStrip}>
          <div className={styles.workflowActive}><span>1</span><b>Capture Evidence</b><small>Fast notes while reading</small></div><i>→</i>
          <div><span>2</span><b>Group by Topic</b><small>Combine specs + drawings</small></div><i>→</i>
          <div><span>3</span><b>Synthesize</b><small>Create / update SLR</small></div><i>→</i>
          <div><span>4</span><b>RFI · RBB · Checklist</b><small>Formal outputs</small></div>
        </div>
        <div className={styles.subtabs}><button className={reviewTab === 'capture' ? styles.subtabActive : ''} onClick={() => setReviewTab('capture')}>Capture Notes <Badge>{notes.length}</Badge></button><button className={reviewTab === 'evidence' ? styles.subtabActive : ''} onClick={() => setReviewTab('evidence')}>Grouped Evidence <Badge>{evidenceGroups.length}</Badge></button></div>

        {reviewTab === 'capture' && <div className={styles.reviewLayout}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Review notebook</span><h2>Capture Evidence</h2></div><div className={styles.buttonRow}><button className={styles.secondary} onClick={loadExampleReview}>Load Example</button><button className={styles.primary} disabled={!capture.topic.trim() || !capture.note.trim()} onClick={addReviewNote}>Save & New</button></div></div>
            <p className={styles.help}>Capture what the document says; do not write the final SLR yet. System + Topic keep related observations together as you move through the specification and drawing set.</p>
            <div className={styles.captureGrid}>
              <label><span>System</span><select value={capture.system} onChange={(event) => setCapture({ ...capture, system: event.target.value })}>{availableSystems.map((system) => <option key={system}>{system}</option>)}</select></label>
              <label><span>Topic</span><input value={capture.topic} onChange={(event) => setCapture({ ...capture, topic: event.target.value })} placeholder="Copper Cabling, MDF / IDF, Training…" /></label>
              <label><span>Source</span><select value={capture.sourceType} onChange={(event) => setCapture({ ...capture, sourceType: event.target.value as ReviewSourceType })}>{SOURCE_TYPES.map((source) => <option key={source}>{source}</option>)}</select></label>
              <label><span>Reference</span><input value={capture.sourceReference} onChange={(event) => setCapture({ ...capture, sourceReference: event.target.value })} placeholder="27 10 00 §2.3.A or T2.01 Note 7" /></label>
              <label className={styles.span2}><span>Observation</span><textarea value={capture.note} onChange={(event) => setCapture({ ...capture, note: event.target.value })} placeholder="Record the requirement, conflict, omission, or useful fact exactly enough that it will make sense during synthesis." /></label>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Current pass</span><h2>Captured Notes</h2></div><button className={styles.secondary} disabled={!notes.length} onClick={() => setReviewTab('evidence')}>Review Groups</button></div>
            <div className={styles.noteList}>{notes.length ? [...notes].reverse().map((note) => <article key={note.id} className={styles.noteCard}><div className={styles.noteMeta}><Badge tone={note.sourceType === 'Drawing' ? 'blue' : note.sourceType === 'Specification' ? 'green' : 'neutral'}>{note.sourceType}</Badge><span>{note.system}</span><b>{note.topic}</b></div><p>{note.note}</p><div className={styles.noteFoot}><span>{note.sourceReference || 'No reference entered'}</span><span>{note.disposition}</span><button onClick={() => removeNote(note.id)}>Remove</button></div></article>) : <div className={styles.emptyState}>No review notes yet. Use the compact capture form while reading the documents.</div>}</div>
          </section>
        </div>}

        {reviewTab === 'evidence' && <div className={styles.evidenceLayout}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Synthesis queue</span><h2>Evidence Groups</h2></div><Badge tone="green">System + Topic</Badge></div>
            <div className={styles.groupList}>{evidenceGroups.length ? evidenceGroups.map((group) => <button key={group.key} className={selectedEvidenceKey === group.key ? styles.groupActive : ''} onClick={() => openEvidence(group)}><div><span>{group.system}</span><b>{group.topic}</b><small>{reviewGroupRecommendation(group)}</small></div><div className={styles.groupMetrics}><Badge>{group.notes.length} note{group.notes.length === 1 ? '' : 's'}</Badge><Badge tone={group.sourceTypes.length > 1 ? 'amber' : 'neutral'}>{group.sourceTypes.join(' + ')}</Badge></div></button>) : <div className={styles.emptyState}>Capture review notes first. Groups appear automatically when notes share a System and Topic.</div>}</div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span>Evidence detail</span><h2>{selectedEvidence?.topic || 'Select an Evidence Group'}</h2></div>{selectedEvidence && <Badge tone="amber">{selectedEvidence.sourceTypes.length} source type{selectedEvidence.sourceTypes.length === 1 ? '' : 's'}</Badge>}</div>
            {selectedEvidence ? <>
              <div className={styles.evidenceStack}>{selectedEvidence.notes.map((note) => <article key={note.id}><div><Badge>{note.sourceType}</Badge><b>{note.sourceReference || 'No reference'}</b></div><p>{note.note}</p></article>)}</div>
              <div className={styles.synthesisBox}>
                <span>SLR synthesis draft</span>
                <label><span>SLR Title</span><input value={slrDraft?.title || ''} onChange={(event) => setSlrDraft((current) => current ? { ...current, title: event.target.value } : current)} /></label>
                <label><span>Scope Concern / Combined Evidence</span><textarea value={slrDraft?.concern || ''} onChange={(event) => setSlrDraft((current) => current ? { ...current, concern: event.target.value } : current)} /></label>
                <label><span>Source References</span><input value={slrDraft?.reference || ''} onChange={(event) => setSlrDraft((current) => current ? { ...current, reference: event.target.value } : current)} /></label>
                <div className={styles.buttonRow}><button className={styles.primary} onClick={stageEvidenceAsSlr}>Create SLR Draft</button><select value={linkTargetUid} onChange={(event) => setLinkTargetUid(event.target.value)}><option value="">Link to existing SLR…</option>{existingSlrs.map((slr) => <option key={slr.uid} value={slr.uid}>{slr.displayNumber} — {slr.title}</option>)}</select><button className={styles.secondary} disabled={!linkTargetUid} onClick={linkEvidenceToExistingSlr}>Link Evidence</button></div>
              </div>
            </> : <div className={styles.emptyState}>Choose a group to see all specification, drawing, addendum, meeting, and field evidence together before deciding what the SLR should say.</div>}
          </section>
        </div>}
      </>}

      {mainTab === 'templates' && <div className={styles.pageGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>Default project confirmations</span><h2>Contractor Checklist Templates</h2></div><button className={styles.primary} onClick={applyChecklistTemplate}>Apply Standard Template</button></div>
          <p className={styles.help}>Checklist templates are different from SLR templates. Common confirmation items can be loaded automatically without creating artificial SLRs.</p>
          <div className={styles.templateCard}><div className={styles.templateHead}><div><b>{STANDARD_CHECKLIST_TEMPLATE.name}</b><span>{STANDARD_CHECKLIST_TEMPLATE.description}</span></div><Badge tone="green">Default pack</Badge></div>{STANDARD_CHECKLIST_TEMPLATE.items.map((item) => <div key={item.id} className={styles.templateItem}><span>{item.category}</span><b>{item.question}</b><Badge>{item.enabledByDefault ? 'Default on' : 'Optional'}</Badge></div>)}</div>
          {checklistItems.length > 0 && <div className={styles.appliedChecklist}><h3>Project Checklist Draft</h3>{checklistItems.map((item, index) => <label key={item.id}><input type="checkbox" checked={item.enabled} onChange={(event) => persistChecklist(checklistItems.map((current, currentIndex) => currentIndex === index ? { ...current, enabled: event.target.checked } : current))} /><span><b>{item.category}</b>{item.question}</span></label>)}</div>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>Reusable scope risks</span><h2>SLR Templates</h2></div><Badge>Opt-in only</Badge></div>
          <p className={styles.help}>SLR templates preload recurring issue language, but never create an SLR automatically. The reviewer decides whether the condition actually exists on this project.</p>
          <div className={styles.slrTemplateList}>{STARTER_SLR_TEMPLATES.map((template) => <article key={template.id}><div><Badge>{template.system}</Badge><b>{template.name}</b></div><p>{template.whenToUse}</p><button className={styles.secondary} onClick={() => useSlrTemplate(template.id)}>Use Template</button></article>)}</div>
        </section>
      </div>}

      {mainTab === 'drafts' && <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>Review output staging</span><h2>SLR Drafts</h2></div><Badge tone="blue">Not written to production</Badge></div>
        <p className={styles.help}>This staging step is deliberate. Evidence is collected first; the SLR becomes the conclusion of the review. A future production action will explicitly move an approved draft into the Internal Matrix.</p>
        <div className={styles.draftList}>{stagedSlrs.length ? stagedSlrs.map((draft) => <article key={draft.id}><div className={styles.draftTop}><div><Badge>{draft.system}</Badge><b>{draft.title}</b><span>{draft.source}</span></div><button onClick={() => persistStagedSlrs(stagedSlrs.filter((item) => item.id !== draft.id))}>Remove</button></div><label><span>Scope Concern</span><textarea value={draft.concern} readOnly /></label><div className={styles.previewLine}><span>References</span><b>{draft.reference || 'Add project-specific references before publishing'}</b></div><div className={styles.draftActions}><button className={styles.primary} disabled title="Intentionally disabled in preview">Approve to Internal Matrix</button><small>Disabled until this workflow is approved and production persistence is implemented.</small></div></article>) : <div className={styles.emptyState}>No SLR drafts staged yet. Build one from grouped evidence or an SLR template.</div>}</div>
      </section>}
    </main>
  </div>;
}
