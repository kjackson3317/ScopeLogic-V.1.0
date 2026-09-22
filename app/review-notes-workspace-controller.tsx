'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';

type ActionFlag = 'RFI' | 'GC Clarification' | 'Contractor Clarification' | 'ScopeLogic Clarification' | 'VE Potential';
type Note = {
  id: string;
  system_name: string;
  topic: string;
  source_type: string;
  source_reference: string;
  observation: string;
  recommended_action: string;
  disposition: string;
  linked_master_finding_id: string | null;
  action_flags?: ActionFlag[];
  created_at: string;
};
type Finding = { id: string; display_number: string; scope_item: string; systems: string[] };
type Group = {
  key: string;
  system: string;
  topic: string;
  notes: Note[];
  flags: ActionFlag[];
  state: 'Unresolved' | 'Reviewed' | 'Linked';
};
type ReviewTab = 'capture' | 'groups';

const ACTION_FLAGS: ActionFlag[] = ['RFI', 'GC Clarification', 'Contractor Clarification', 'ScopeLogic Clarification', 'VE Potential'];
const SOURCE_TYPES = ['Specification', 'Drawing', 'Addendum', 'Bid Document', 'RFI Response', 'Meeting', 'Field Observation', 'Proposal', 'Other'];
const DEFAULT_SYSTEMS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8', 'technology-precon-r14-8', 'technology-precon-r14-7', 'technology-precon-r14-6', 'technology-precon-r14-5', 'technology-precon-r14-4', 'technology-precon-r14-3', 'technology-precon-r14-2'];
const text = (value: unknown) => String(value ?? '').trim();
const groupKey = (system: string, topic: string) => `${system.trim().toLowerCase()}::${topic.trim().toLowerCase()}`;

function groupState(notes: Note[]): Group['state'] {
  if (notes.length && notes.every((note) => note.disposition === 'No Action')) return 'Reviewed';
  if (notes.length && notes.every((note) => Boolean(note.linked_master_finding_id))) return 'Linked';
  return 'Unresolved';
}

function currentLegacyProjectId() {
  for (const key of LOCAL_WORKSPACE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const id = text(parsed?.projectId);
      if (id) return id;
    } catch {}
  }
  return '';
}

function StructuredReviewNotes({ masterId }: { masterId: string }) {
  const supabase = useMemo(() => createClient() as any, []);
  const [tab, setTab] = useState<ReviewTab>('capture');
  const [notes, setNotes] = useState<Note[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [projectSystems, setProjectSystems] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('All');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [capture, setCapture] = useState({
    system_name: 'Structured Cabling',
    topic: '',
    source_type: 'Specification',
    source_reference: '',
    observation: '',
    recommended_action: '',
    action_flags: [] as ActionFlag[],
  });
  const [selectedGroup, setSelectedGroup] = useState('');
  const [resolution, setResolution] = useState<'none' | 'existing'>('none');
  const [existingFindingId, setExistingFindingId] = useState('');

  const [editingNoteId, setEditingNoteId] = useState('');
  const [editDraft, setEditDraft] = useState({
    system_name: '',
    topic: '',
    source_type: 'Other',
    source_reference: '',
    observation: '',
    recommended_action: '',
    disposition: 'Unreviewed',
    linked_master_finding_id: '',
    action_flags: [] as ActionFlag[],
  });

  const [slrSourceNote, setSlrSourceNote] = useState<Note | null>(null);
  const [slrDraft, setSlrDraft] = useState({
    system_name: '',
    scope_item: '',
    scope_concern: '',
    recommended_bid_basis: '',
    rfi_question: '',
    source_type: 'Other',
    reference: '',
    include_clarification: false,
    include_formal_rfi: false,
  });

  const load = useCallback(async () => {
    const [notesResult, findingsResult, masterResult] = await Promise.all([
      supabase
        .from('master_project_review_notes')
        .select('id,system_name,topic,source_type,source_reference,observation,recommended_action,disposition,linked_master_finding_id,action_flags,created_at')
        .eq('master_project_id', masterId)
        .order('created_at', { ascending: false }),
      supabase
        .from('master_project_findings')
        .select('id,display_number,scope_item,systems')
        .eq('master_project_id', masterId)
        .order('sequence_number'),
      supabase.from('master_projects').select('owner_id,systems').eq('id', masterId).maybeSingle(),
    ]);
    const failure = notesResult.error || findingsResult.error || masterResult.error;
    if (failure) {
      setError(failure.message || 'Review workflow data could not be loaded.');
      return;
    }
    setError('');
    setNotes((notesResult.data || []).map((item: any) => ({ ...item, action_flags: Array.isArray(item.action_flags) ? item.action_flags : [] })) as Note[]);
    setFindings((findingsResult.data || []).map((item: any) => ({ ...item, systems: Array.isArray(item.systems) ? item.systems : [] })) as Finding[]);
    setProjectSystems(Array.isArray(masterResult.data?.systems) ? masterResult.data.systems : []);
    setOwnerId(text(masterResult.data?.owner_id));
  }, [masterId, supabase]);

  useEffect(() => {
    void load();
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [load]);

  const systems = useMemo(
    () => Array.from(new Set([...projectSystems, ...DEFAULT_SYSTEMS, ...notes.map((note) => text(note.system_name))].filter(Boolean))),
    [notes, projectSystems],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of notes) {
      const key = groupKey(note.system_name, note.topic);
      map.set(key, [...(map.get(key) || []), note]);
    }
    return [...map.entries()]
      .map(([key, items]): Group => ({
        key,
        system: text(items[0]?.system_name) || 'Other',
        topic: text(items[0]?.topic) || 'Untitled Topic',
        notes: items,
        flags: Array.from(new Set(items.flatMap((item) => item.action_flags || []))) as ActionFlag[],
        state: groupState(items),
      }))
      .sort((a, b) => a.system.localeCompare(b.system, undefined, { numeric: true }) || a.topic.localeCompare(b.topic, undefined, { numeric: true }));
  }, [notes]);

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return groups.filter(
      (group) =>
        (systemFilter === 'All' || group.system === systemFilter) &&
        (!needle ||
          [group.system, group.topic, ...group.notes.flatMap((note) => [note.source_type, note.source_reference, note.observation, ...(note.action_flags || [])])]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    );
  }, [groups, search, systemFilter]);

  const activeGroup = groups.find((group) => group.key === selectedGroup) || null;
  const toggleFlag = (flag: ActionFlag) =>
    setCapture((current) => ({
      ...current,
      action_flags: current.action_flags.includes(flag) ? current.action_flags.filter((item) => item !== flag) : [...current.action_flags, flag],
    }));

  const saveAndNew = async () => {
    if (!capture.topic.trim() || !capture.observation.trim()) {
      setError('Topic and Observation are required.');
      return;
    }
    if (!ownerId) {
      setError('The Master Project owner could not be resolved. Refresh Review Notes and try again.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data?.user) throw new Error('Your ScopeLogic session is not available. Sign in again.');
      const result = await supabase.from('master_project_review_notes').insert({
        owner_id: ownerId,
        master_project_id: masterId,
        created_by_user_id: auth.data.user.id,
        system_name: capture.system_name,
        topic: capture.topic.trim(),
        source_type: capture.source_type,
        source_reference: capture.source_reference.trim(),
        observation: capture.observation.trim(),
        recommended_action: capture.recommended_action.trim(),
        action_flags: capture.action_flags,
        disposition: 'Unreviewed',
        linked_master_finding_id: null,
      });
      if (result.error) throw new Error(result.error.message);
      setCapture((current) => ({ ...current, source_reference: '', observation: '', recommended_action: '', action_flags: [] }));
      await load();
      setMessage('Review Note saved. System, Topic, and Source Type were retained for the next observation.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Review Note could not be saved.');
    } finally {
      setBusy(false);
    }
  };


  const startEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditDraft({
      system_name: note.system_name || 'Other',
      topic: note.topic || '',
      source_type: note.source_type || 'Other',
      source_reference: note.source_reference || '',
      observation: note.observation || '',
      recommended_action: note.recommended_action || '',
      disposition: note.disposition || 'Unreviewed',
      linked_master_finding_id: note.linked_master_finding_id || '',
      action_flags: [...(note.action_flags || [])],
    });
  };

  const toggleEditFlag = (flag: ActionFlag) => {
    setEditDraft((current) => ({
      ...current,
      action_flags: current.action_flags.includes(flag)
        ? current.action_flags.filter((item) => item !== flag)
        : [...current.action_flags, flag],
    }));
  };

  const saveEditedNote = async () => {
    if (!editingNoteId || !editDraft.topic.trim() || !editDraft.observation.trim()) return;
    setBusy(true);
    setError('');
    try {
      const linkedId = editDraft.linked_master_finding_id || null;
      const disposition = linkedId
        ? 'Linked to SLR'
        : editDraft.disposition === 'Linked to SLR'
          ? 'Unreviewed'
          : editDraft.disposition;

      const result = await supabase
        .from('master_project_review_notes')
        .update({
          system_name: editDraft.system_name,
          topic: editDraft.topic.trim(),
          source_type: editDraft.source_type,
          source_reference: editDraft.source_reference.trim(),
          observation: editDraft.observation.trim(),
          recommended_action: editDraft.recommended_action.trim(),
          disposition,
          linked_master_finding_id: linkedId,
          action_flags: editDraft.action_flags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNoteId);

      if (result.error) throw new Error(result.error.message);
      setEditingNoteId('');
      await load();
      setMessage('Review Note updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Review Note could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const openCreateSlr = (note: Note) => {
    const flags = note.action_flags || [];
    setSlrSourceNote(note);
    setSlrDraft({
      system_name: note.system_name || 'Other',
      scope_item: note.topic || '',
      scope_concern: note.observation || '',
      recommended_bid_basis: note.recommended_action || '',
      rfi_question: flags.includes('RFI') ? note.recommended_action || '' : '',
      source_type: note.source_type || 'Other',
      reference: note.source_reference || '',
      include_clarification:
        flags.includes('GC Clarification') ||
        flags.includes('Contractor Clarification') ||
        flags.includes('ScopeLogic Clarification'),
      include_formal_rfi: flags.includes('RFI'),
    });
  };

  const saveCreatedSlr = async () => {
    if (!slrSourceNote || !ownerId || !slrDraft.scope_item.trim()) return;
    setBusy(true);
    setError('');
    try {
      const nextSequence =
        findings.reduce((max, item) => {
          const number = Number(String(item.display_number || '').replace(/\D/g, '')) || 0;
          return Math.max(max, number);
        }, 0) + 1;

      const displayNumber = `SLR-${String(nextSequence).padStart(3, '0')}`;
      const recommended = slrDraft.recommended_bid_basis.trim();

      const result = await supabase
        .from('master_project_findings')
        .insert({
          owner_id: ownerId,
          master_project_id: masterId,
          legacy_uid: crypto.randomUUID(),
          sequence_number: nextSequence,
          display_number: displayNumber,
          systems: [slrDraft.system_name],
          custom_system: '',
          scope_item: slrDraft.scope_item.trim(),
          status: 'Open',
          scope_concern: slrDraft.scope_concern.trim(),
          recommended_bid_basis: recommended,
          recommended_bid_basis_by_system: recommended
            ? { [slrDraft.system_name]: recommended }
            : {},
          rfi_question: slrDraft.rfi_question.trim(),
          reason_basis: '',
          reference: slrDraft.reference.trim(),
          source_type: slrDraft.source_type,
          include_sow: false,
          include_clarification: slrDraft.include_clarification,
          include_formal_rfi: slrDraft.include_formal_rfi,
          checklist_scope_item: '',
        })
        .select('id,display_number,scope_item,systems')
        .single();

      if (result.error) throw new Error(result.error.message);

      const link = await supabase
        .from('master_project_review_notes')
        .update({
          linked_master_finding_id: result.data.id,
          disposition: 'Linked to SLR',
          updated_at: new Date().toISOString(),
        })
        .eq('id', slrSourceNote.id);

      if (link.error) throw new Error(link.error.message);

      setSlrSourceNote(null);
      await load();
      setMessage(`${displayNumber} created and linked to the Review Note.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The SLR could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const updateGroupNotes = async (group: Group, payload: Record<string, unknown>) => {
    for (const note of group.notes) {
      const result = await supabase
        .from('master_project_review_notes')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', note.id);
      if (result.error) throw new Error(result.error.message);
    }
  };

  const resolveNoAction = async () => {
    if (!activeGroup) return;
    setBusy(true);
    setError('');
    try {
      await updateGroupNotes(activeGroup, { disposition: 'No Action', linked_master_finding_id: null });
      setSelectedGroup('');
      setResolution('none');
      await load();
      setMessage(`${activeGroup.system} / ${activeGroup.topic} marked reviewed with no further action.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The evidence group could not be resolved.');
    } finally {
      setBusy(false);
    }
  };

  const linkExisting = async () => {
    if (!activeGroup || !existingFindingId) {
      setError('Select the existing SLR that should receive this evidence.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateGroupNotes(activeGroup, { disposition: 'Linked to SLR', linked_master_finding_id: existingFindingId });
      const finding = findings.find((item) => item.id === existingFindingId);
      setSelectedGroup('');
      setResolution('none');
      setExistingFindingId('');
      await load();
      setMessage(`Evidence linked to ${finding?.display_number || 'the selected SLR'}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The evidence could not be linked to the SLR.');
    } finally {
      setBusy(false);
    }
  };

  const openResolve = (group: Group) => {
    setSelectedGroup(group.key);
    setResolution('none');
    setExistingFindingId(group.notes.find((note) => note.linked_master_finding_id)?.linked_master_finding_id || '');
  };

  const popoutEvidence = () =>
    window.open(`/master-projects/${masterId}/review-observations`, 'scopelogic-evidence-groups', 'popup=yes,width=1180,height=900,resizable=yes,scrollbars=yes');

  return (
    <section className="sl-review-workflow" data-review-workflow-ready="true">
      <div className="sl-review-workflow-strip">
        <b className={tab === 'capture' ? 'active' : ''}>1 · Capture</b><span>→</span>
        <b className={tab === 'groups' ? 'active' : ''}>2 · Group</b><span>→</span><b>3 · Resolve</b>
      </div>
      <div className="sl-review-tabs">
        <button type="button" className={tab === 'capture' ? 'active' : ''} onClick={() => setTab('capture')}>Quick Capture</button>
        <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>Evidence Groups <span>{groups.length}</span></button>
        <button type="button" onClick={popoutEvidence}>Pop Out Evidence Groups</button>
        <button type="button" onClick={() => void load()}>Refresh</button>
      </div>

      {error ? <div className="sl-review-workflow-error">{error}<button type="button" onClick={() => setError('')}>×</button></div> : null}
      {message ? <div className="sl-review-workflow-message">{message}<button type="button" onClick={() => setMessage('')}>×</button></div> : null}

      {tab === 'capture' ? (
        <div className="sl-review-capture">
          <div className="sl-review-capture-grid">
            <label><span>System</span><select value={capture.system_name} onChange={(event) => setCapture({ ...capture, system_name: event.target.value })}>{systems.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Topic</span><input list={`sl-review-topics-${masterId}`} value={capture.topic} onChange={(event) => setCapture({ ...capture, topic: event.target.value })} placeholder="e.g. Existing access control integration"/><datalist id={`sl-review-topics-${masterId}`}>{Array.from(new Set(notes.map((note) => note.topic).filter(Boolean))).map((item) => <option key={item} value={item}/>)}</datalist></label>
            <label><span>Source Type</span><select value={capture.source_type} onChange={(event) => setCapture({ ...capture, source_type: event.target.value })}>{SOURCE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Source Reference</span><input value={capture.source_reference} onChange={(event) => setCapture({ ...capture, source_reference: event.target.value })} placeholder="Sheet, detail, spec section, page…"/></label>
            <label className="wide"><span>Observation</span><textarea rows={3} value={capture.observation} onChange={(event) => setCapture({ ...capture, observation: event.target.value })} placeholder="Capture what the document says or what you observed. Do not synthesize the final SLR yet."/></label>
            <label className="wide"><span>Recommended Action <small>(optional)</small></span><textarea rows={2} value={capture.recommended_action} onChange={(event) => setCapture({ ...capture, recommended_action: event.target.value })} placeholder="Example: Contractor Clarification — Have Miller confirm inclusion; VE — evaluate alternate display architecture."/></label>
          </div>
          <div className="sl-review-action-flags">
            <div><b>Potential Follow-Up</b><small>Optional and multi-select. These flags do not issue a deliverable.</small></div>
            <div>{ACTION_FLAGS.map((flag) => <label key={flag} className={capture.action_flags.includes(flag) ? 'selected' : ''}><input type="checkbox" checked={capture.action_flags.includes(flag)} onChange={() => toggleFlag(flag)}/><span>{flag}</span></label>)}</div>
          </div>
          <div className="sl-review-capture-footer">
            <small>Save & New keeps System, Topic, and Source Type so you can continue reading without re-entering context.</small>
            <button type="button" className="primary" disabled={busy || !capture.topic.trim() || !capture.observation.trim()} onClick={() => void saveAndNew()}>{busy ? 'Saving…' : 'Save & New'}</button>
          </div>
        </div>
      ) : null}

      {tab === 'groups' ? (
        <div className="sl-review-evidence">
          <div className="sl-review-grouped-controls">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search evidence, topics, references…"/>
            <select value={systemFilter} onChange={(event) => setSystemFilter(event.target.value)}><option value="All">All Systems</option>{systems.map((item) => <option key={item}>{item}</option>)}</select>
            <div className="sl-review-count"><b>Grouped by System + Topic</b><span>{visibleGroups.length} groups · {notes.length} notes</span></div>
          </div>
          <div className="sl-review-manual-note"><b>Review workflow</b><span>Review Notes are grouped by System, then Topic. Edit a note directly, link it to an existing SLR, or use Create SLR to promote it without retyping the issue.</span></div>
          {visibleGroups.length ? (
            <div className="sl-review-system-groups">
              {Array.from(new Set(visibleGroups.map((group) => group.system))).map((systemName) => {
                const topicGroups = visibleGroups.filter((group) => group.system === systemName);
                const systemNoteCount = topicGroups.reduce((sum, group) => sum + group.notes.length, 0);
                return (
                  <details className="sl-review-system-group" key={systemName} open>
                    <summary className="sl-review-system-summary">
                      <span>▸</span>
                      <b>{systemName}</b>
                      <strong>{systemNoteCount} {systemNoteCount === 1 ? 'note' : 'notes'}</strong>
                    </summary>
                    <div className="sl-review-topic-groups">
                      {topicGroups.map((group) => (
                        <details className="sl-review-topic-group" key={group.key} open={group.key === selectedGroup}>
                          <summary>
                            <span>▸</span>
                            <div><b>{group.topic}</b><small>{group.notes.length} {group.notes.length === 1 ? 'note' : 'notes'}</small></div>
                            <div className={`sl-review-state ${group.state.toLowerCase().replace(/\s+/g, '-')}`}>{group.state}</div>
                          </summary>

                          <div className="sl-review-group-body">
                            <div className="sl-review-group-actions">
                              {group.flags.length
                                ? <div>{group.flags.map((flag) => <span key={flag}>{flag}</span>)}</div>
                                : <small>No potential follow-up flags selected.</small>}
                              <button type="button" onClick={() => openResolve(group)}>Resolve Group</button>
                            </div>

                            <div className="sl-review-group-items">
                              {group.notes.map((note) => (
                                <article key={note.id}>
                                  <header className="sl-review-note-head">
                                    <div>
                                      <b>{note.source_type}</b>
                                      <span>{note.source_reference || 'No source reference'}</span>
                                    </div>
                                    <div className="sl-review-note-actions">
                                      <button type="button" onClick={() => startEditNote(note)}>Edit</button>
                                      <button
                                        type="button"
                                        disabled={Boolean(note.linked_master_finding_id)}
                                        onClick={() => openCreateSlr(note)}
                                      >
                                        {note.linked_master_finding_id ? 'SLR Linked' : 'Create SLR'}
                                      </button>
                                    </div>
                                  </header>

                                  <p>{note.observation}</p>

                                  {note.recommended_action ? (
                                    <div className="sl-review-recommended">
                                      <b>Recommended Action</b>
                                      <span>{note.recommended_action}</span>
                                    </div>
                                  ) : null}

                                  <footer>
                                    <span>{note.disposition || 'Unreviewed'}</span>
                                    {note.linked_master_finding_id
                                      ? <span>{findings.find((item) => item.id === note.linked_master_finding_id)?.display_number || 'Linked SLR'}</span>
                                      : null}
                                  </footer>

                                  {editingNoteId === note.id ? (
                                    <div className="sl-review-note-editor">
                                      <div className="sl-review-edit-grid">
                                        <label>
                                          <span>System</span>
                                          <select value={editDraft.system_name} onChange={(event) => setEditDraft({ ...editDraft, system_name: event.target.value })}>
                                            {systems.map((item) => <option key={item}>{item}</option>)}
                                          </select>
                                        </label>
                                        <label>
                                          <span>Topic</span>
                                          <input value={editDraft.topic} onChange={(event) => setEditDraft({ ...editDraft, topic: event.target.value })}/>
                                        </label>
                                        <label>
                                          <span>Source Type</span>
                                          <select value={editDraft.source_type} onChange={(event) => setEditDraft({ ...editDraft, source_type: event.target.value })}>
                                            {SOURCE_TYPES.map((item) => <option key={item}>{item}</option>)}
                                          </select>
                                        </label>
                                        <label>
                                          <span>Source Reference</span>
                                          <input value={editDraft.source_reference} onChange={(event) => setEditDraft({ ...editDraft, source_reference: event.target.value })}/>
                                        </label>
                                        <label className="wide">
                                          <span>Observation</span>
                                          <textarea rows={4} value={editDraft.observation} onChange={(event) => setEditDraft({ ...editDraft, observation: event.target.value })}/>
                                        </label>
                                        <label className="wide">
                                          <span>Recommended Action</span>
                                          <textarea rows={3} value={editDraft.recommended_action} onChange={(event) => setEditDraft({ ...editDraft, recommended_action: event.target.value })}/>
                                        </label>
                                        <label>
                                          <span>Disposition</span>
                                          <select value={editDraft.disposition} onChange={(event) => setEditDraft({ ...editDraft, disposition: event.target.value })}>
                                            {['Unreviewed','No Action','Checklist','SLR','Linked to SLR'].map((item) => <option key={item}>{item}</option>)}
                                          </select>
                                        </label>
                                        <label>
                                          <span>Linked SLR</span>
                                          <select value={editDraft.linked_master_finding_id} onChange={(event) => setEditDraft({ ...editDraft, linked_master_finding_id: event.target.value })}>
                                            <option value="">None</option>
                                            {findings.map((item) => <option key={item.id} value={item.id}>{item.display_number} — {item.scope_item}</option>)}
                                          </select>
                                        </label>
                                      </div>

                                      <div className="sl-review-edit-flags">
                                        {ACTION_FLAGS.map((flag) => (
                                          <label key={flag} className={editDraft.action_flags.includes(flag) ? 'selected' : ''}>
                                            <input type="checkbox" checked={editDraft.action_flags.includes(flag)} onChange={() => toggleEditFlag(flag)}/>
                                            <span>{flag}</span>
                                          </label>
                                        ))}
                                      </div>

                                      <div className="sl-review-edit-actions">
                                        <button type="button" onClick={() => setEditingNoteId('')}>Cancel</button>
                                        <button type="button" className="primary" disabled={busy || !editDraft.topic.trim() || !editDraft.observation.trim()} onClick={() => void saveEditedNote()}>
                                          {busy ? 'Saving…' : 'Save Changes'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </article>
                              ))}
                            </div>

                            {group.key === selectedGroup ? (
                              <div className="sl-review-resolve">
                                <div><b>Resolve Evidence Group</b><small>Close the group with no further action or link its notes to an existing SLR.</small></div>
                                <div className="sl-review-resolve-choices">
                                  <label className={resolution === 'none' ? 'selected' : ''}>
                                    <input type="radio" name="review-resolution-native" checked={resolution === 'none'} onChange={() => setResolution('none')}/>
                                    <span>No further action</span>
                                  </label>
                                  <label className={resolution === 'existing' ? 'selected' : ''}>
                                    <input type="radio" name="review-resolution-native" checked={resolution === 'existing'} onChange={() => setResolution('existing')}/>
                                    <span>Add Evidence to Existing SLR</span>
                                  </label>
                                </div>

                                {resolution === 'existing' ? (
                                  <label className="sl-review-existing">
                                    <span>Existing SLR</span>
                                    <select value={existingFindingId} onChange={(event) => setExistingFindingId(event.target.value)}>
                                      <option value="">Select SLR…</option>
                                      {findings.map((item) => <option key={item.id} value={item.id}>{item.display_number} — {item.scope_item}</option>)}
                                    </select>
                                  </label>
                                ) : null}

                                <div className="sl-review-resolve-footer">
                                  <button type="button" onClick={() => { setSelectedGroup(''); setResolution('none'); }}>Cancel</button>
                                  {resolution === 'none'
                                    ? <button type="button" className="primary" disabled={busy} onClick={() => void resolveNoAction()}>Mark Reviewed</button>
                                    : <button type="button" className="primary" disabled={busy || !existingFindingId} onClick={() => void linkExisting()}>Link Evidence</button>}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : <div className="sl-review-grouped-empty">No evidence groups match the current filters.</div>}
        </div>
      ) : null}

      {slrSourceNote ? (
        <div className="sl-review-modal-backdrop">
          <section className="sl-review-modal">
            <div className="sl-review-modal-head">
              <div>
                <span>CREATE FROM REVIEW NOTE</span>
                <h2>Create SLR</h2>
              </div>
              <button type="button" onClick={() => setSlrSourceNote(null)}>×</button>
            </div>

            <div className="sl-review-edit-grid">
              <label>
                <span>System</span>
                <select value={slrDraft.system_name} onChange={(event) => setSlrDraft({ ...slrDraft, system_name: event.target.value })}>
                  {systems.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label>
                <span>Source Type</span>
                <select value={slrDraft.source_type} onChange={(event) => setSlrDraft({ ...slrDraft, source_type: event.target.value })}>
                  {SOURCE_TYPES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label className="wide">
                <span>Scope Item</span>
                <input value={slrDraft.scope_item} onChange={(event) => setSlrDraft({ ...slrDraft, scope_item: event.target.value })}/>
              </label>

              <label className="wide">
                <span>Scope Concern</span>
                <textarea rows={4} value={slrDraft.scope_concern} onChange={(event) => setSlrDraft({ ...slrDraft, scope_concern: event.target.value })}/>
              </label>

              <label className="wide">
                <span>Recommended Bid Basis / Solution</span>
                <textarea rows={3} value={slrDraft.recommended_bid_basis} onChange={(event) => setSlrDraft({ ...slrDraft, recommended_bid_basis: event.target.value })}/>
              </label>

              <label className="wide">
                <span>RFI Question</span>
                <textarea rows={2} value={slrDraft.rfi_question} onChange={(event) => setSlrDraft({ ...slrDraft, rfi_question: event.target.value })}/>
              </label>

              <label className="wide">
                <span>Source Reference</span>
                <input value={slrDraft.reference} onChange={(event) => setSlrDraft({ ...slrDraft, reference: event.target.value })}/>
              </label>
            </div>

            <div className="sl-review-slr-options">
              <label><input type="checkbox" checked={slrDraft.include_clarification} onChange={(event) => setSlrDraft({ ...slrDraft, include_clarification: event.target.checked })}/> Include in Clarification</label>
              <label><input type="checkbox" checked={slrDraft.include_formal_rfi} onChange={(event) => setSlrDraft({ ...slrDraft, include_formal_rfi: event.target.checked })}/> Include in Formal RFI</label>
            </div>

            <div className="sl-review-edit-actions">
              <button type="button" onClick={() => setSlrSourceNote(null)}>Cancel</button>
              <button type="button" className="primary" disabled={busy || !slrDraft.scope_item.trim()} onClick={() => void saveCreatedSlr()}>
                {busy ? 'Saving…' : 'Create & Link SLR'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function restoreWorkspace() {
  document.querySelectorAll<HTMLElement>('[data-sl-review-native-hidden="true"]').forEach((element) => {
    element.style.display = element.dataset.slReviewNativePreviousDisplay || '';
    delete element.dataset.slReviewNativeHidden;
    delete element.dataset.slReviewNativePreviousDisplay;
  });
  document.querySelector<HTMLElement>('[data-native-review-host]')?.remove();
  document.body.classList.remove('sl-review-native-open');
  document.querySelector<HTMLElement>('#scopelogic-review-notes-live-nav')?.classList.remove('active');
}

export default function ReviewNotesWorkspaceController() {
  const supabase = useMemo(() => createClient() as any, []);
  const [open, setOpen] = useState(false);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [masterId, setMasterId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resolveCurrentMaster = useCallback(async () => {
    setLoading(true);
    setError('');
    setMasterId('');
    try {
      let resolvedMasterId = '';
      const legacyId = currentLegacyProjectId();
      if (legacyId) {
        const byLegacy = await supabase.from('projects').select('master_project_id').eq('legacy_id', legacyId).maybeSingle();
        if (byLegacy.error) throw new Error(byLegacy.error.message);
        resolvedMasterId = text(byLegacy.data?.master_project_id);
        if (!resolvedMasterId && /^[0-9a-f-]{36}$/i.test(legacyId)) {
          const byId = await supabase.from('projects').select('master_project_id').eq('id', legacyId).maybeSingle();
          if (byId.error) throw new Error(byId.error.message);
          resolvedMasterId = text(byId.data?.master_project_id);
        }
      }
      if (!resolvedMasterId) {
        const visibleName = text(document.querySelector<HTMLElement>('.project-switch b')?.textContent);
        if (visibleName) {
          const byName = await supabase.from('master_projects').select('id,name').eq('name', visibleName).limit(2);
          if (byName.error) throw new Error(byName.error.message);
          if ((byName.data || []).length === 1) resolvedMasterId = text(byName.data[0].id);
        }
      }
      if (!resolvedMasterId) throw new Error('The current Master Project could not be resolved. Open the project from the Project Library and try Review Notes again.');
      const master = await supabase.from('master_projects').select('id,name').eq('id', resolvedMasterId).maybeSingle();
      if (master.error) throw new Error(master.error.message);
      setMasterId(resolvedMasterId);
      setProjectName(text(master.data?.name) || 'Current Master Project');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The current Master Project could not be resolved.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const openReviewNotes = useCallback(() => {
    setOpen(true);
    void resolveCurrentMaster();
  }, [resolveCurrentMaster]);

  useEffect(() => {
    const handler = () => openReviewNotes();
    window.addEventListener('scopelogic:open-review-notes', handler);
    return () => window.removeEventListener('scopelogic:open-review-notes', handler);
  }, [openReviewNotes]);

  useEffect(() => {
    const button = document.querySelector<HTMLElement>('#scopelogic-review-notes-live-nav');
    if (button) button.classList.toggle('active', open);
  }, [open, mount]);

  useEffect(() => {
    if (!open) {
      restoreWorkspace();
      setMount(null);
      return;
    }

    let queued = false;
    const installHost = () => {
      const page = document.querySelector<HTMLElement>('.main .page');
      if (!page) return false;
      let host = page.querySelector<HTMLElement>(':scope > [data-native-review-host]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.nativeReviewHost = 'true';
        host.className = 'sl-review-live-page';
        page.appendChild(host);
      }
      Array.from(page.children).forEach((child) => {
        if (child === host || !(child instanceof HTMLElement) || child.dataset.slReviewNativeHidden === 'true') return;
        child.dataset.slReviewNativeHidden = 'true';
        child.dataset.slReviewNativePreviousDisplay = child.style.display || '';
        child.style.display = 'none';
      });
      document.body.classList.add('sl-review-native-open');
      document.querySelector<HTMLElement>('#scopelogic-review-notes-live-nav')?.classList.add('active');
      setMount(host);
      return true;
    };
    const refresh = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        installHost();
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    const page = document.querySelector('.main .page');
    if (page) observer.observe(page, { childList: true });
    return () => {
      observer.disconnect();
      restoreWorkspace();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const leave = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const nav = target.closest('aside.sidebar button, aside.sidebar a');
      if (!nav || nav.id === 'scopelogic-review-notes-live-nav') return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', leave, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', leave, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return mount && open
    ? createPortal(
        <div className="sl-review-live-content" data-review-notes-native="true">
          <div className="sl-review-live-head">
            <div>
              <span>PROJECT REVIEW</span>
              <h1>Review Notes</h1>
              <p>Capture raw evidence once, group it automatically by System + Topic, and use those evidence groups while you create or update SLRs.</p>
              {projectName ? <small>{projectName}</small> : null}
            </div>
            <button type="button" onClick={() => void resolveCurrentMaster()}>Refresh Project</button>
          </div>
          {loading ? <div className="sl-review-live-status">Loading structured Review Notes…</div> : null}
          {!loading && error ? <div className="sl-review-workflow-error"><span>{error}</span><button type="button" onClick={() => void resolveCurrentMaster()}>Retry</button></div> : null}
          {!loading && !error && masterId ? <StructuredReviewNotes masterId={masterId}/> : null}
          {!loading && !error && !masterId ? <div className="sl-review-live-status">Select a Master Project to begin.</div> : null}
        </div>,
        mount,
      )
    : null;
}
