'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { DEMO_MASTER_ID, DEMO_PROJECT_ID, DEMO_WORKSPACE_KEY } from '../lib/demo/config';
import { readDemoWorkspace } from '../lib/demo/client';

type ReviewNote = {
  id: string;
  system_name: string;
  topic: string;
  source_type: string;
  source_reference: string;
  observation: string;
  disposition: string;
  linked_master_finding_id: string | null;
};

type Finding = { id: string; display_number: string; scope_item: string; systems: string[] };

const pad=(n:number)=>String(n).padStart(3,'0');

export default function DemoProjectReviewPanel(){
  const supabase=useMemo(()=>createClient(),[]);
  const [notes,setNotes]=useState<ReviewNote[]>([]);
  const [findings,setFindings]=useState<Finding[]>([]);
  const [search,setSearch]=useState('');
  const [system,setSystem]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [draft,setDraft]=useState({system_name:'Structured Cabling',source_type:'Drawing',source_reference:'',topic:'',observation:''});
  const [message,setMessage]=useState('');

  const load=async()=>{
    const [n,f]=await Promise.all([
      supabase.from('master_project_review_notes').select('*').eq('master_project_id',DEMO_MASTER_ID).order('created_at'),
      supabase.from('master_project_findings').select('id,display_number,scope_item,systems').eq('master_project_id',DEMO_MASTER_ID).order('sequence_number'),
    ]);
    if(!n.error)setNotes((n.data||[]) as ReviewNote[]);
    if(!f.error)setFindings((f.data||[]) as Finding[]);
  };
  useEffect(()=>{void load()},[]);

  const findingMap=useMemo(()=>new Map(findings.map((item)=>[item.id,item])),[findings]);
  const systems=useMemo(()=>Array.from(new Set(notes.map((item)=>item.system_name).filter(Boolean))).sort(),[notes]);
  const visible=useMemo(()=>notes.filter((item)=>{
    const needle=search.trim().toLowerCase();
    return (!system||item.system_name===system)&&(!needle||[item.topic,item.observation,item.source_reference,item.system_name,item.source_type,item.disposition].join(' ').toLowerCase().includes(needle));
  }),[notes,search,system]);

  const saveObservation=async()=>{
    if(!draft.topic.trim()||!draft.observation.trim()){setMessage('Topic and observation are required.');return;}
    const result=await supabase.from('master_project_review_notes').insert({
      owner_id:'demo-presenter',master_project_id:DEMO_MASTER_ID,created_by_user_id:'demo-presenter',
      system_name:draft.system_name,topic:draft.topic.trim(),source_type:draft.source_type,
      source_reference:draft.source_reference.trim(),observation:draft.observation.trim(),
      snippet_label:'',disposition:'Unreviewed',linked_master_finding_id:null
    });
    if(result.error){setMessage(result.error.message);return;}
    setDraft({system_name:'Structured Cabling',source_type:'Drawing',source_reference:'',topic:'',observation:''});
    setShowForm(false);setMessage('Review observation saved.');await load();
  };

  const createSlr=async(note:ReviewNote)=>{
    const workspace=readDemoWorkspace();
    const issues=workspace.issuesByProject[DEMO_PROJECT_ID]||[];
    const id=crypto.randomUUID();
    const sequence=issues.length+1;
    issues.push({
      uid:id,id:'SLR-'+pad(sequence),system:note.system_name,customSystem:'',systems:[note.system_name],
      recommendations:{},title:note.topic,status:'Open',concern:note.observation,rfiQuestion:'',basis:'',reason:'',
      reference:note.source_reference,sourceType:note.source_type,rfi:'',resolution:'',snippet:'',sow:false,
      clarification:false,formalRfi:false,checklist:false,checklistItem:'',checklistItems:{},response:'Included',
      responseReason:'',numberLocked:false,numberReleasedAt:'',rbbScopeLetterMap:{},rfis:[],recommendBaseBids:[],checklistQuestions:[]
    });
    workspace.issuesByProject[DEMO_PROJECT_ID]=issues;
    localStorage.setItem(DEMO_WORKSPACE_KEY,JSON.stringify(workspace));
    const result=await supabase.from('master_project_review_notes').update({linked_master_finding_id:id,disposition:'Linked to SLR'}).eq('id',note.id);
    if(result.error){setMessage(result.error.message);return;}
    setMessage('SLR created. Reloading the local workspace…');
    window.setTimeout(()=>window.location.reload(),250);
  };

  return <section className="demo-review-panel">
    <div className="demo-review-head"><div><span>STRUCTURED REVIEW</span><b>Project Review</b></div><small>{visible.length} / {notes.length}</small></div>
    <div className="demo-review-toolbar">
      <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search observations, references…" />
      <select value={system} onChange={(event)=>setSystem(event.target.value)}><option value="">All systems</option>{systems.map((value)=><option key={value}>{value}</option>)}</select>
      <button className="secondary" onClick={()=>setShowForm((value)=>!value)}>{showForm?'Close':'+ Observation'}</button>
    </div>
    {showForm&&<div className="demo-review-form">
      <label>System<input value={draft.system_name} onChange={(event)=>setDraft({...draft,system_name:event.target.value})}/></label>
      <label>Source Type<select value={draft.source_type} onChange={(event)=>setDraft({...draft,source_type:event.target.value})}>{['Drawing','Specification','Addendum','Narrative','Meeting','Field','Other'].map((value)=><option key={value}>{value}</option>)}</select></label>
      <label className="full">Topic<input value={draft.topic} onChange={(event)=>setDraft({...draft,topic:event.target.value})}/></label>
      <label className="full">Source Reference<input value={draft.source_reference} onChange={(event)=>setDraft({...draft,source_reference:event.target.value})} placeholder="T2.01 / 27 10 00 §3.2…"/></label>
      <label className="full">Observation<textarea value={draft.observation} onChange={(event)=>setDraft({...draft,observation:event.target.value})}/></label>
      <div className="demo-review-form-actions"><button className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary" onClick={()=>void saveObservation()}>Save Observation</button></div>
    </div>}
    {message&&<div className="sync-note">{message}</div>}
    <div className="demo-review-list">
      {visible.map((note)=>{
        const finding=note.linked_master_finding_id?findingMap.get(note.linked_master_finding_id):undefined;
        return <article className="demo-review-item" key={note.id}>
          <div className="demo-review-item-head"><div><span>{note.system_name} · {note.source_type}</span><h4>{note.topic}</h4></div><span>{note.disposition}</span></div>
          <p>{note.observation}</p>
          <dl><div><dt>Reference</dt><dd>{note.source_reference||'—'}</dd></div><div><dt>Related SLR</dt><dd>{finding?finding.display_number:'—'}</dd></div></dl>
          {!note.linked_master_finding_id&&<button className="secondary" onClick={()=>void createSlr(note)}>Create SLR</button>}
        </article>
      })}
      {!visible.length&&<div className="empty-compact">No review observations match the current filters.</div>}
    </div>
  </section>;
}
