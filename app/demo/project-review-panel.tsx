'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { DEMO_MASTER_ID, DEMO_PROJECT_ID, DEMO_WORKSPACE_KEY } from '../../lib/demo/config';
import { readDemoWorkspace } from '../../lib/demo/client';
import styles from './project-review-panel.module.css';

type Finding={id:string;display_number:string;scope_item:string;systems:string[];status:string};
type Note={id:string;system_name:string;topic:string;source_type:string;source_reference:string;observation:string;disposition:string;linked_master_finding_id:string|null;created_at:string};
const pad=(n:number)=>String(n).padStart(3,'0');
const blank=()=>({system_name:'Structured Cabling',topic:'',source_type:'Drawing',source_reference:'',observation:'',disposition:'Unreviewed',linked_master_finding_id:null as string|null});

export default function DemoProjectReviewPanel(){
 const supabase=useMemo(()=>createClient(),[]);
 const [notes,setNotes]=useState<Note[]>([]);const [findings,setFindings]=useState<Finding[]>([]);const [draft,setDraft]=useState(blank());
 const [adding,setAdding]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const load=useCallback(async()=>{const [n,f]=await Promise.all([
  supabase.from('master_project_review_notes').select('*').eq('master_project_id',DEMO_MASTER_ID).order('created_at'),
  supabase.from('master_project_findings').select('id,display_number,scope_item,systems,status').eq('master_project_id',DEMO_MASTER_ID).order('sequence_number')
 ]);const e=n.error||f.error;if(e){setError(e.message);return;}setNotes((n.data||[]) as Note[]);setFindings((f.data||[]) as Finding[]);},[supabase]);
 useEffect(()=>{void load()},[load]);
 const findingMap=useMemo(()=>new Map(findings.map(x=>[x.id,x])),[findings]);
 const saveNote=async()=>{if(!draft.topic.trim()||!draft.observation.trim()){setError('Topic and observation are required.');return;}const result=await supabase.from('master_project_review_notes').insert({owner_id:'demo-presenter',master_project_id:DEMO_MASTER_ID,created_by_user_id:'demo-presenter',...draft,topic:draft.topic.trim(),source_reference:draft.source_reference.trim(),observation:draft.observation.trim()});if(result.error){setError(result.error.message);return;}setDraft(blank());setAdding(false);setMessage('Review note saved.');await load();};
 const linkNote=async(note:Note,findingId:string)=>{const result=await supabase.from('master_project_review_notes').update({linked_master_finding_id:findingId||null,disposition:findingId?'Linked to SLR':'Unreviewed'}).eq('id',note.id);if(result.error){setError(result.error.message);return;}await load();};
 const createSlr=async(note:Note)=>{
  const workspace=readDemoWorkspace();const issues=workspace.issuesByProject?.[DEMO_PROJECT_ID]||[];const uid=crypto.randomUUID();const sequence=issues.length+1;
  issues.push({uid,id:`SLR-${pad(sequence)}`,system:note.system_name,customSystem:'',systems:[note.system_name],recommendations:{},title:note.topic,status:'Open',concern:note.observation,rfiQuestion:'',basis:'',reason:'',reference:note.source_reference,sourceType:note.source_type,rfi:'',resolution:'',snippet:'',sow:false,clarification:true,formalRfi:false,checklist:false,checklistItem:'',checklistItems:{},response:'Included',responseReason:'',numberLocked:false,numberReleasedAt:'',rbbScopeLetterMap:{},rfis:[],recommendBaseBids:[],checklistQuestions:[]});
  workspace.issuesByProject[DEMO_PROJECT_ID]=issues;localStorage.setItem(DEMO_WORKSPACE_KEY,JSON.stringify(workspace));
  const result=await supabase.from('master_project_review_notes').update({linked_master_finding_id:uid,disposition:'Linked to SLR'}).eq('id',note.id);if(result.error){setError(result.error.message);return;}setMessage(`${note.topic} created as SLR-${pad(sequence)}.`);await load();
 };
 return <section className={styles.panel}>
  <header className={styles.header}><div><span>PROJECT REVIEW</span><h2>Review Observations</h2><p>Capture drawing/spec observations beside your working notes, then link or promote them to an SLR.</p></div><button onClick={()=>setAdding(v=>!v)}>{adding?'Cancel':'+ Review Note'}</button></header>
  {error?<div className={styles.error}>{error}<button onClick={()=>setError('')}>×</button></div>:null}{message?<div className={styles.message}>{message}<button onClick={()=>setMessage('')}>×</button></div>:null}
  {adding?<div className={styles.form}><div className={styles.row}><label>System<input value={draft.system_name} onChange={e=>setDraft(d=>({...d,system_name:e.target.value}))}/></label><label>Source Type<select value={draft.source_type} onChange={e=>setDraft(d=>({...d,source_type:e.target.value}))}>{['Drawing','Specification','Addendum','Narrative','Meeting','Field','Other'].map(x=><option key={x}>{x}</option>)}</select></label></div><label>Topic<input value={draft.topic} onChange={e=>setDraft(d=>({...d,topic:e.target.value}))} placeholder="Scope topic / issue"/></label><label>Source Reference<input value={draft.source_reference} onChange={e=>setDraft(d=>({...d,source_reference:e.target.value}))} placeholder="Drawing, detail, note or spec section"/></label><label>Observation<textarea rows={4} value={draft.observation} onChange={e=>setDraft(d=>({...d,observation:e.target.value}))} placeholder="What did you find?"/></label><button className={styles.primary} onClick={()=>void saveNote()}>Save Review Note</button></div>:null}
  <div className={styles.list}>{notes.length?notes.slice().reverse().map(note=>{const finding=note.linked_master_finding_id?findingMap.get(note.linked_master_finding_id):null;return <article key={note.id} className={styles.card}><div className={styles.cardTop}><div><span>{note.system_name} · {note.source_type}</span><h3>{note.topic}</h3></div><b>{note.disposition}</b></div><p>{note.observation}</p><div className={styles.reference}>Source: {note.source_reference||'No reference entered'}</div><div className={styles.actions}>{finding?<><span className={styles.linked}>{finding.display_number} · {finding.scope_item}</span><select value={note.linked_master_finding_id||''} onChange={e=>void linkNote(note,e.target.value)}><option value="">Unlink SLR</option>{findings.map(f=><option key={f.id} value={f.id}>{f.display_number} — {f.scope_item}</option>)}</select></>:<><button className={styles.primary} onClick={()=>void createSlr(note)}>Create SLR</button><select value="" onChange={e=>e.target.value&&void linkNote(note,e.target.value)}><option value="">Link existing SLR…</option>{findings.map(f=><option key={f.id} value={f.id}>{f.display_number} — {f.scope_item}</option>)}</select></>}</div></article>}):<div className={styles.empty}>No project review observations yet.</div>}</div>
 </section>;
}
