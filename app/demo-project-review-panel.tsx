'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { DEMO_MASTER_ID, DEMO_PROJECT_ID, DEMO_WORKSPACE_KEY } from '../lib/demo/config';
import { readDemoWorkspace } from '../lib/demo/client';
import styles from './demo-workflow-panels.module.css';

type Note = {
  id: string;
  system_name: string;
  topic: string;
  source_type: string;
  source_reference: string;
  observation: string;
  disposition: string;
  linked_master_finding_id: string | null;
};

type Props = { onOpenSlr?: () => void };
const pad = (value: number) => String(value).padStart(3, '0');
const systems = ['Structured Cabling', 'CCTV', 'Access Control', 'Audio Visual', 'Paging', 'Other'];

export default function DemoProjectReviewPanel({ onOpenSlr }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ system_name: 'Structured Cabling', topic: '', source_type: 'Drawing', source_reference: '', observation: '' });

  const load = useCallback(async () => {
    const result = await supabase.from('master_project_review_notes').select('*').eq('master_project_id', DEMO_MASTER_ID).order('created_at');
    if (result.error) { setError(result.error.message); return; }
    setNotes((result.data || []) as Note[]);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const saveNote = async () => {
    setError('');
    if (!draft.topic.trim() || !draft.observation.trim()) {
      setError('Topic and observation are required.');
      return;
    }
    const result = await supabase.from('master_project_review_notes').insert({
      owner_id: 'demo-presenter',
      master_project_id: DEMO_MASTER_ID,
      created_by_user_id: 'demo-presenter',
      system_name: draft.system_name,
      topic: draft.topic.trim(),
      source_type: draft.source_type,
      source_reference: draft.source_reference.trim(),
      observation: draft.observation.trim(),
      snippet_label: '',
      disposition: 'Unreviewed',
      linked_master_finding_id: null,
    });
    if (result.error) { setError(result.error.message); return; }
    setDraft({ system_name: 'Structured Cabling', topic: '', source_type: 'Drawing', source_reference: '', observation: '' });
    setMessage('Project review observation saved.');
    await load();
  };

  const createSlr = async (note: Note) => {
    setError('');
    const workspace = readDemoWorkspace();
    const issues = workspace.issuesByProject?.[DEMO_PROJECT_ID] || [];
    const sequence = issues.length + 1;
    const uid = crypto.randomUUID();
    issues.push({
      uid,
      id: `SLR-${pad(sequence)}`,
      system: note.system_name,
      systems: [note.system_name],
      customSystem: '',
      title: note.topic,
      concern: note.observation,
      status: 'Open',
      recommendations: {},
      basis: '',
      reason: '',
      reference: note.source_reference,
      sourceType: note.source_type,
      rfi: '',
      resolution: '',
      snippet: '',
      sow: false,
      clarification: false,
      formalRfi: false,
      checklist: false,
      rfiQuestion: '',
      checklistItem: '',
      checklistItems: {},
      response: '',
      responseReason: '',
      numberLocked: false,
      numberReleasedAt: '',
      rbbScopeLetterMap: {},
      rfis: [],
      recommendBaseBids: [],
      checklistQuestions: [],
    });
    workspace.issuesByProject[DEMO_PROJECT_ID] = issues;
    localStorage.setItem(DEMO_WORKSPACE_KEY, JSON.stringify(workspace));
    const result = await supabase.from('master_project_review_notes').update({ linked_master_finding_id: uid, disposition: 'Linked to SLR' }).eq('id', note.id);
    if (result.error) { setError(result.error.message); return; }
    setMessage(`Created SLR-${pad(sequence)} from the review observation.`);
    await load();
  };

  return <section className={styles.panel} aria-label="Project Review">
    <div className={styles.panelHeader}>
      <div><span className={styles.eyebrow}>PROJECT REVIEW</span><h2>Review Observations</h2><p>Capture drawing/spec observations beside Internal Notes and promote only real scope risks into the SLR workflow.</p></div>
      {onOpenSlr && <button className={`${styles.button} ${styles.primary}`} onClick={onOpenSlr}>Open SLR Matrix</button>}
    </div>
    <div className={styles.body}>
      {message && <div className={styles.message}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.noteForm}>
        <label>System<select value={draft.system_name} onChange={(event) => setDraft({ ...draft, system_name: event.target.value })}>{systems.map((system) => <option key={system}>{system}</option>)}</select></label>
        <label>Source Type<select value={draft.source_type} onChange={(event) => setDraft({ ...draft, source_type: event.target.value })}><option>Drawing</option><option>Specification</option><option>Addendum</option><option>Bid Document</option><option>Site Observation</option></select></label>
        <label className={styles.full}>Topic<input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} placeholder="Example: Camera coverage at public entry" /></label>
        <label className={styles.full}>Source Reference<input value={draft.source_reference} onChange={(event) => setDraft({ ...draft, source_reference: event.target.value })} placeholder="T2.01 Detail 4; 28 23 00 §2.4" /></label>
        <label className={styles.full}>Observation<textarea value={draft.observation} onChange={(event) => setDraft({ ...draft, observation: event.target.value })} placeholder="State what the documents show and why it needs review." /></label>
        <div className={styles.formActions}><button className={`${styles.button} ${styles.primary}`} onClick={() => void saveNote()}>Save Observation</button></div>
      </div>
      <div className={styles.cards}>
        {notes.length ? notes.slice().reverse().map((note) => <article className={styles.card} key={note.id}>
          <div className={styles.cardTop}><div><span className={styles.meta}>{note.system_name} · {note.source_type}</span><b>{note.topic}</b></div><span className={styles.meta}>{note.disposition}</span></div>
          <p>{note.observation}</p>
          <div className={styles.cardFooter}><span className={styles.meta}>{note.source_reference || 'No source reference entered'}</span>{note.linked_master_finding_id ? <span className={styles.linked}>Linked to SLR</span> : <button className={styles.button} onClick={() => void createSlr(note)}>Create SLR</button>}</div>
        </article>) : <div className={styles.empty}>No project review observations yet.</div>}
      </div>
    </div>
  </section>;
}
