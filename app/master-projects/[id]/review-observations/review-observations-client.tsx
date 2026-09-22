'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import styles from './review-observations.module.css';

type ActionFlag =
  | 'RFI'
  | 'GC Clarification'
  | 'Contractor Clarification'
  | 'ScopeLogic Clarification'
  | 'VE Potential';

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

type Finding = {
  id: string;
  display_number: string;
  scope_item: string;
  systems: string[];
};

type Master = {
  project_number: string;
  name: string;
  revision: string;
  status: string;
  owner_id: string;
  systems: string[];
};

type TopicGroup = {
  key: string;
  system: string;
  topic: string;
  notes: Note[];
  flags: ActionFlag[];
  state: 'Unresolved' | 'Reviewed' | 'Linked';
};

const ACTION_FLAGS: ActionFlag[] = [
  'RFI',
  'GC Clarification',
  'Contractor Clarification',
  'ScopeLogic Clarification',
  'VE Potential',
];

const SOURCE_TYPES = [
  'Specification',
  'Drawing',
  'Addendum',
  'Bid Document',
  'RFI Response',
  'Meeting',
  'Field Observation',
  'Proposal',
  'Other',
];

const DEFAULT_SYSTEMS = [
  'Structured Cabling',
  'Network Electronics',
  'CCTV',
  'Access Control',
  'Intrusion Detection',
  'Fire Alarm',
  'Video Intercom',
  'Audio Visual',
  'Paging / Intercom',
  'Other',
];

const text = (value: unknown) => String(value ?? '').trim();

const groupKey = (system: string, topic: string) =>
  `${system.trim().toLowerCase()}::${topic.trim().toLowerCase()}`;

function groupState(notes: Note[]): TopicGroup['state'] {
  if (notes.length && notes.every((note) => note.disposition === 'No Action')) return 'Reviewed';
  if (notes.length && notes.every((note) => Boolean(note.linked_master_finding_id))) return 'Linked';
  return 'Unresolved';
}

export default function ReviewObservationsClient({
  masterProjectId,
}: {
  masterProjectId: string;
}) {
  const supabase = useMemo(() => createClient() as any, []);

  const [master, setMaster] = useState<Master | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);

  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    const [m, n, f] = await Promise.all([
      supabase
        .from('master_projects')
        .select('project_number,name,revision,status,owner_id,systems')
        .eq('id', masterProjectId)
        .maybeSingle(),

      supabase
        .from('master_project_review_notes')
        .select(
          'id,system_name,topic,source_type,source_reference,observation,recommended_action,disposition,linked_master_finding_id,action_flags,created_at',
        )
        .eq('master_project_id', masterProjectId)
        .order('created_at', { ascending: false }),

      supabase
        .from('master_project_findings')
        .select('id,display_number,scope_item,systems')
        .eq('master_project_id', masterProjectId)
        .order('sequence_number'),
    ]);

    const failure = m.error || n.error || f.error;

    if (failure) {
      setError(failure.message || 'Review Notes could not be loaded.');
      return;
    }

    setError('');
    setMaster(
      m.data
        ? {
            ...m.data,
            systems: Array.isArray(m.data.systems) ? m.data.systems : [],
          }
        : null,
    );

    setNotes(
      (n.data || []).map((item: any) => ({
        ...item,
        recommended_action: item.recommended_action || '',
        action_flags: Array.isArray(item.action_flags) ? item.action_flags : [],
      })) as Note[],
    );

    setFindings(
      (f.data || []).map((item: any) => ({
        ...item,
        systems: Array.isArray(item.systems) ? item.systems : [],
      })) as Finding[],
    );
  }, [masterProjectId, supabase]);

  useEffect(() => {
    void load();

    const focus = () => void load();
    window.addEventListener('focus', focus);

    return () => window.removeEventListener('focus', focus);
  }, [load]);

  const systems = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_SYSTEMS,
          ...(master?.systems || []),
          ...notes.map((note) => text(note.system_name)).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [master, notes],
  );

  const sources = useMemo(
    () =>
      Array.from(
        new Set([
          ...SOURCE_TYPES,
          ...notes.map((note) => text(note.source_type)).filter(Boolean),
        ]),
      ).sort(),
    [notes],
  );

  const visibleNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return notes.filter(
      (note) =>
        (systemFilter === 'All' || note.system_name === systemFilter) &&
        (sourceFilter === 'All' || note.source_type === sourceFilter) &&
        (!needle ||
          [
            note.system_name,
            note.topic,
            note.source_type,
            note.source_reference,
            note.observation,
            note.recommended_action,
            note.disposition,
            ...(note.action_flags || []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    );
  }, [notes, search, systemFilter, sourceFilter]);

  const topicGroups = useMemo(() => {
    const map = new Map<string, Note[]>();

    for (const note of visibleNotes) {
      const key = groupKey(note.system_name, note.topic);
      map.set(key, [...(map.get(key) || []), note]);
    }

    return [...map.entries()]
      .map(
        ([key, items]): TopicGroup => ({
          key,
          system: text(items[0]?.system_name) || 'Other',
          topic: text(items[0]?.topic) || 'Untitled Topic',
          notes: items,
          flags: Array.from(
            new Set(items.flatMap((item) => item.action_flags || [])),
          ) as ActionFlag[],
          state: groupState(items),
        }),
      )
      .sort(
        (a, b) =>
          a.system.localeCompare(b.system, undefined, { numeric: true }) ||
          a.topic.localeCompare(b.topic, undefined, { numeric: true }),
      );
  }, [visibleNotes]);

  const visibleSystems = useMemo(
    () => Array.from(new Set(topicGroups.map((group) => group.system))),
    [topicGroups],
  );

  const findingLabel = (id: string | null) =>
    id
      ? findings.find((item) => item.id === id)?.display_number || 'Linked SLR'
      : '';

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
    if (
      !editingNoteId ||
      !editDraft.topic.trim() ||
      !editDraft.observation.trim()
    ) {
      return;
    }

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
      setError(
        cause instanceof Error
          ? cause.message
          : 'The Review Note could not be updated.',
      );
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
    if (!slrSourceNote || !master?.owner_id || !slrDraft.scope_item.trim()) return;

    setBusy(true);
    setError('');

    try {
      const nextSequence =
        findings.reduce((max, item) => {
          const number = Number(String(item.display_number || '').replace(/\\D/g, '')) || 0;
          return Math.max(max, number);
        }, 0) + 1;

      const displayNumber = `SLR-${String(nextSequence).padStart(3, '0')}`;
      const recommended = slrDraft.recommended_bid_basis.trim();
      const legacyUid = crypto.randomUUID();

      /*
       * slr_entries is the canonical SLR table used by the existing
       * ScopeLogic Internal Matrix. Its database trigger synchronizes
       * the record into master_project_findings.
       *
       * If this Master Project does not have a Client Engagement yet,
       * preserve the Master-Project-first workflow by writing directly
       * to master_project_findings until an engagement exists.
       */
      const engagementResult = await supabase
        .from('projects')
        .select('id')
        .eq('master_project_id', masterProjectId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (engagementResult.error) throw new Error(engagementResult.error.message);

      const sourceProjectId = String(engagementResult.data?.[0]?.id || '');
      let masterFindingId = '';

      if (sourceProjectId) {
        const entryResult = await supabase
          .from('slr_entries')
          .insert({
            owner_id: master.owner_id,
            project_id: sourceProjectId,
            legacy_uid: legacyUid,
            sequence_number: nextSequence,
            display_number: displayNumber,
            system_name: slrDraft.system_name,
            custom_system: '',
            systems: [slrDraft.system_name],
            scope_item: slrDraft.scope_item.trim(),
            status: 'Open',
            scope_concern: slrDraft.scope_concern.trim(),
            rfi_question: slrDraft.rfi_question.trim(),
            recommended_bid_basis: recommended,
            recommended_bid_basis_by_system: recommended
              ? { [slrDraft.system_name]: recommended }
              : {},
            reason_basis: '',
            reference: slrDraft.reference.trim(),
            source_type: slrDraft.source_type,
            rfi_number: '',
            resolution: '',
            snippet_number: '',
            include_sow: false,
            include_clarification: slrDraft.include_clarification,
            include_formal_rfi: slrDraft.include_formal_rfi,
            checklist_scope_item: '',
            checklist_scope_items_by_system: {},
            contractor_response: 'Included',
            contractor_response_reason: '',
            ai_assistance: {},
          })
          .select('id,display_number')
          .single();

        if (entryResult.error) throw new Error(entryResult.error.message);

        /*
         * sync_slr_to_master is an AFTER INSERT trigger, so re-read the
         * SLR after insert to obtain the Master Finding ID created by it.
         */
        const syncResult = await supabase
          .from('slr_entries')
          .select('master_finding_id')
          .eq('id', entryResult.data.id)
          .single();

        if (syncResult.error) throw new Error(syncResult.error.message);

        masterFindingId = String(syncResult.data?.master_finding_id || '');

        if (!masterFindingId) {
          throw new Error(
            'The SLR was saved, but its Master Project finding could not be resolved.'
          );
        }
      } else {
        const findingResult = await supabase
          .from('master_project_findings')
          .insert({
            owner_id: master.owner_id,
            master_project_id: masterProjectId,
            legacy_uid: legacyUid,
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
          .select('id')
          .single();

        if (findingResult.error) throw new Error(findingResult.error.message);
        masterFindingId = String(findingResult.data.id);
      }

      const linkResult = await supabase
        .from('master_project_review_notes')
        .update({
          linked_master_finding_id: masterFindingId,
          disposition: 'Linked to SLR',
          updated_at: new Date().toISOString(),
        })
        .eq('id', slrSourceNote.id);

      if (linkResult.error) throw new Error(linkResult.error.message);

      setSlrSourceNote(null);
      await load();
      setMessage(`${displayNumber} created and linked to the Review Note.`);

      /*
       * The legacy Internal Matrix maintains an in-memory workspace snapshot.
       * Force that screen to reload from the canonical cloud SLR table so the
       * newly created SLR is visible immediately.
       */
      if (typeof window !== 'undefined') {
        if (window.opener && !window.opener.closed) {
          window.opener.location.reload();
        } else {
          window.setTimeout(() => window.location.reload(), 350);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The SLR could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.shell}>
      <header>
        <div>
          <span>REVIEW NOTES</span>
          <h1>{master?.name || 'Review Notes'}</h1>
          <p>
            {master
              ? `${master.project_number} · ${master.revision} · ${master.status}`
              : 'Loading project…'}
          </p>
        </div>

        <div>
          <button onClick={() => void load()}>Refresh</button>
          <button onClick={() => window.close()}>Close Window</button>
        </div>
      </header>

      <section className={styles.notice}>
        Review Notes are grouped by <b>System</b>, then <b>Topic</b>. Edit
        notes here or promote an issue directly to an SLR without retyping it.
      </section>

      <section className={styles.controls}>
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes, references, recommended actions, flags…"
        />

        <select
          value={systemFilter}
          onChange={(event) => setSystemFilter(event.target.value)}
        >
          <option value="All">All Systems</option>
          {systems.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
        >
          <option value="All">All Source Types</option>
          {sources.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}
      {message ? <div className={styles.message}>{message}</div> : null}

      <section className={styles.groups}>
        <div className={styles.count}>
          {visibleSystems.length} systems · {topicGroups.length} topics ·{' '}
          {visibleNotes.length} of {notes.length} notes
        </div>

        {visibleSystems.map((systemName) => {
          const systemGroups = topicGroups.filter(
            (group) => group.system === systemName,
          );

          const systemNoteCount = systemGroups.reduce(
            (sum, group) => sum + group.notes.length,
            0,
          );

          return (
            <details className={styles.systemGroup} key={systemName} open>
              <summary className={styles.systemSummary}>
                <span>▸</span>
                <b>{systemName}</b>
                <strong>
                  {systemNoteCount} {systemNoteCount === 1 ? 'note' : 'notes'}
                </strong>
              </summary>

              <div className={styles.topicGroups}>
                {systemGroups.map((group) => (
                  <details className={styles.topicGroup} key={group.key}>
                    <summary>
                      <span>▸</span>

                      <div className={styles.groupIdentity}>
                        <b>{group.topic}</b>
                        <small>
                          {group.notes.length}{' '}
                          {group.notes.length === 1 ? 'note' : 'notes'}
                        </small>
                      </div>

                      <div className={styles.flags}>
                        {group.flags.map((flag) => (
                          <em key={flag}>{flag}</em>
                        ))}
                      </div>

                      <div
                        className={`${styles.state} ${
                          group.state === 'Unresolved'
                            ? styles.unresolved
                            : group.state === 'Linked'
                              ? styles.linked
                              : styles.reviewed
                        }`}
                      >
                        {group.state}
                      </div>
                    </summary>

                    <div className={styles.notes}>
                      {group.notes.map((note) => (
                        <article key={note.id}>
                          <div className={styles.itemHead}>
                            <div>
                              <b>{note.source_type}</b>
                              <span>
                                {note.source_reference || 'No source reference'}
                              </span>
                            </div>

                            <div className={styles.noteActions}>
                              <span>
                                {note.disposition || 'Unreviewed'}
                              </span>

                              <button onClick={() => startEditNote(note)}>
                                Edit
                              </button>

                              <button
                                disabled={Boolean(
                                  note.linked_master_finding_id,
                                )}
                                onClick={() => openCreateSlr(note)}
                              >
                                {note.linked_master_finding_id
                                  ? 'SLR Linked'
                                  : 'Create SLR'}
                              </button>
                            </div>
                          </div>

                          <p>{note.observation}</p>

                          {note.recommended_action ? (
                            <div className={styles.recommended}>
                              <b>Recommended Action</b>
                              <span>{note.recommended_action}</span>
                            </div>
                          ) : null}

                          <footer>
                            <b>Topic</b>
                            <span>{note.topic || 'Untitled Topic'}</span>

                            {note.linked_master_finding_id ? (
                              <>
                                <b>Linked SLR</b>
                                <span>
                                  {findingLabel(
                                    note.linked_master_finding_id,
                                  )}
                                </span>
                              </>
                            ) : null}
                          </footer>

                          {editingNoteId === note.id ? (
                            <div className={styles.editor}>
                              <div className={styles.editGrid}>
                                <label>
                                  <span>System</span>
                                  <select
                                    value={editDraft.system_name}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        system_name: event.target.value,
                                      })
                                    }
                                  >
                                    {systems.map((item) => (
                                      <option key={item}>{item}</option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  <span>Topic</span>
                                  <input
                                    value={editDraft.topic}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        topic: event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  <span>Source Type</span>
                                  <select
                                    value={editDraft.source_type}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        source_type: event.target.value,
                                      })
                                    }
                                  >
                                    {sources.map((item) => (
                                      <option key={item}>{item}</option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  <span>Source Reference</span>
                                  <input
                                    value={editDraft.source_reference}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        source_reference: event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label className={styles.wide}>
                                  <span>Observation</span>
                                  <textarea
                                    rows={4}
                                    value={editDraft.observation}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        observation: event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label className={styles.wide}>
                                  <span>Recommended Action</span>
                                  <textarea
                                    rows={3}
                                    value={editDraft.recommended_action}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        recommended_action:
                                          event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  <span>Disposition</span>
                                  <select
                                    value={editDraft.disposition}
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        disposition: event.target.value,
                                      })
                                    }
                                  >
                                    {[
                                      'Unreviewed',
                                      'No Action',
                                      'Checklist',
                                      'SLR',
                                      'Linked to SLR',
                                    ].map((item) => (
                                      <option key={item}>{item}</option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  <span>Linked SLR</span>
                                  <select
                                    value={
                                      editDraft.linked_master_finding_id
                                    }
                                    onChange={(event) =>
                                      setEditDraft({
                                        ...editDraft,
                                        linked_master_finding_id:
                                          event.target.value,
                                      })
                                    }
                                  >
                                    <option value="">None</option>
                                    {findings.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.display_number} —{' '}
                                        {item.scope_item}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <div className={styles.editFlags}>
                                {ACTION_FLAGS.map((flag) => (
                                  <label
                                    key={flag}
                                    className={
                                      editDraft.action_flags.includes(flag)
                                        ? styles.selectedFlag
                                        : ''
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editDraft.action_flags.includes(
                                        flag,
                                      )}
                                      onChange={() => toggleEditFlag(flag)}
                                    />
                                    <span>{flag}</span>
                                  </label>
                                ))}
                              </div>

                              <div className={styles.editActions}>
                                <button
                                  onClick={() => setEditingNoteId('')}
                                >
                                  Cancel
                                </button>

                                <button
                                  className={styles.primary}
                                  disabled={
                                    busy ||
                                    !editDraft.topic.trim() ||
                                    !editDraft.observation.trim()
                                  }
                                  onClick={() => void saveEditedNote()}
                                >
                                  {busy ? 'Saving…' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          );
        })}

        {!visibleSystems.length ? (
          <div className={styles.empty}>
            No Review Notes match the current filters.
          </div>
        ) : null}
      </section>

      {slrSourceNote ? (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <div className={styles.modalHead}>
              <div>
                <span>CREATE FROM REVIEW NOTE</span>
                <h2>Create SLR</h2>
              </div>

              <button onClick={() => setSlrSourceNote(null)}>×</button>
            </div>

            <div className={styles.editGrid}>
              <label>
                <span>System</span>
                <select
                  value={slrDraft.system_name}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      system_name: event.target.value,
                    })
                  }
                >
                  {systems.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Source Type</span>
                <select
                  value={slrDraft.source_type}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      source_type: event.target.value,
                    })
                  }
                >
                  {sources.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className={styles.wide}>
                <span>Scope Item</span>
                <input
                  value={slrDraft.scope_item}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      scope_item: event.target.value,
                    })
                  }
                />
              </label>

              <label className={styles.wide}>
                <span>Scope Concern</span>
                <textarea
                  rows={4}
                  value={slrDraft.scope_concern}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      scope_concern: event.target.value,
                    })
                  }
                />
              </label>

              <label className={styles.wide}>
                <span>Recommended Bid Basis / Solution</span>
                <textarea
                  rows={3}
                  value={slrDraft.recommended_bid_basis}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      recommended_bid_basis: event.target.value,
                    })
                  }
                />
              </label>

              <label className={styles.wide}>
                <span>RFI Question</span>
                <textarea
                  rows={2}
                  value={slrDraft.rfi_question}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      rfi_question: event.target.value,
                    })
                  }
                />
              </label>

              <label className={styles.wide}>
                <span>Source Reference</span>
                <input
                  value={slrDraft.reference}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      reference: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className={styles.slrOptions}>
              <label>
                <input
                  type="checkbox"
                  checked={slrDraft.include_clarification}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      include_clarification: event.target.checked,
                    })
                  }
                />
                Include in Clarification
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={slrDraft.include_formal_rfi}
                  onChange={(event) =>
                    setSlrDraft({
                      ...slrDraft,
                      include_formal_rfi: event.target.checked,
                    })
                  }
                />
                Include in Formal RFI
              </label>
            </div>

            <div className={styles.editActions}>
              <button onClick={() => setSlrSourceNote(null)}>Cancel</button>

              <button
                className={styles.primary}
                disabled={busy || !slrDraft.scope_item.trim()}
                onClick={() => void saveCreatedSlr()}
              >
                {busy ? 'Saving…' : 'Create & Link SLR'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
