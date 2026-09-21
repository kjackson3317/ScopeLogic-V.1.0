'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import styles from './review-observations.module.css';

type ActionFlag='RFI'|'GC Clarification'|'Contractor Clarification'|'ScopeLogic Clarification'|'VE Potential';
type Note={id:string;system_name:string;topic:string;source_type:string;source_reference:string;observation:string;disposition:string;linked_master_finding_id:string|null;action_flags?:ActionFlag[];created_at:string};
type Finding={id:string;display_number:string;scope_item:string};
type Master={project_number:string;name:string;revision:string;status:string};
type Group={key:string;system:string;topic:string;notes:Note[];flags:ActionFlag[];state:'Unresolved'|'Reviewed'|'Linked'};

const text=(value:unknown)=>String(value??'').trim();
const groupKey=(system:string,topic:string)=>`${system.trim().toLowerCase()}::${topic.trim().toLowerCase()}`;
function groupState(notes:Note[]):Group['state']{
 if(notes.length&&notes.every(note=>note.disposition==='No Action'))return 'Reviewed';
 if(notes.length&&notes.every(note=>Boolean(note.linked_master_finding_id)))return 'Linked';
 return 'Unresolved';
}

export default function ReviewObservationsClient({masterProjectId}:{masterProjectId:string}){
 const supabase=useMemo(()=>createClient() as any,[]);
 const [master,setMaster]=useState<Master|null>(null);
 const [notes,setNotes]=useState<Note[]>([]);
 const [findings,setFindings]=useState<Finding[]>([]);
 const [search,setSearch]=useState('');
 const [system,setSystem]=useState('All');
 const [source,setSource]=useState('All');
 const [error,setError]=useState('');

 const load=useCallback(async()=>{
  const [m,n,f]=await Promise.all([
   supabase.from('master_projects').select('project_number,name,revision,status').eq('id',masterProjectId).maybeSingle(),
   supabase.from('master_project_review_notes').select('id,system_name,topic,source_type,source_reference,observation,disposition,linked_master_finding_id,action_flags,created_at').eq('master_project_id',masterProjectId).order('created_at',{ascending:false}),
   supabase.from('master_project_findings').select('id,display_number,scope_item').eq('master_project_id',masterProjectId).order('sequence_number'),
  ]);
  const failure=m.error||n.error||f.error;
  if(failure){setError(failure.message||'Evidence Groups could not be loaded.');return;}
  setError('');
  setMaster(m.data as Master|null);
  setNotes((n.data||[]).map((item:any)=>({...item,action_flags:Array.isArray(item.action_flags)?item.action_flags:[]})) as Note[]);
  setFindings((f.data||[]) as Finding[]);
 },[masterProjectId,supabase]);

 useEffect(()=>{void load();const focus=()=>void load();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[load]);

 const systems=useMemo(()=>Array.from(new Set(notes.map(note=>text(note.system_name)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[notes]);
 const sources=useMemo(()=>Array.from(new Set(notes.map(note=>text(note.source_type)).filter(Boolean))).sort(),[notes]);
 const visibleNotes=useMemo(()=>{const needle=search.trim().toLowerCase();return notes.filter(note=>(system==='All'||note.system_name===system)&&(source==='All'||note.source_type===source)&&(!needle||[note.system_name,note.topic,note.source_type,note.source_reference,note.observation,note.disposition,...(note.action_flags||[])].join(' ').toLowerCase().includes(needle)))},[notes,search,system,source]);
 const groups=useMemo(()=>{
  const map=new Map<string,Note[]>();
  for(const note of visibleNotes){const key=groupKey(note.system_name,note.topic);map.set(key,[...(map.get(key)||[]),note]);}
  return [...map.entries()].map(([key,items]):Group=>({
   key,
   system:text(items[0]?.system_name)||'Other',
   topic:text(items[0]?.topic)||'Untitled Topic',
   notes:items,
   flags:Array.from(new Set(items.flatMap(item=>item.action_flags||[]))) as ActionFlag[],
   state:groupState(items),
  })).sort((a,b)=>a.system.localeCompare(b.system,undefined,{numeric:true})||a.topic.localeCompare(b.topic,undefined,{numeric:true}));
 },[visibleNotes]);
 const findingLabel=(id:string|null)=>id?(findings.find(item=>item.id===id)?.display_number||'Linked SLR'):'';

 return <main className={styles.shell}>
  <header><div><span>DETACHED EVIDENCE GROUPS</span><h1>{master?.name||'Evidence Groups'}</h1><p>{master?`${master.project_number} · ${master.revision} · ${master.status}`:'Loading project…'}</p></div><div><button onClick={()=>void load()}>Refresh</button><button onClick={()=>window.close()}>Close Window</button></div></header>
  <section className={styles.notice}><b>Manual SLR reference.</b> Keep this window open while you create or edit SLRs in the main ScopeLogic window. Evidence is grouped by <b>System + Topic</b>; this window does not create SLRs.</section>
  <section className={styles.controls}><input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search evidence, topics, references, follow-up flags…"/><select value={system} onChange={event=>setSystem(event.target.value)}><option value="All">All Systems</option>{systems.map(item=><option key={item}>{item}</option>)}</select><select value={source} onChange={event=>setSource(event.target.value)}><option value="All">All Source Types</option>{sources.map(item=><option key={item}>{item}</option>)}</select></section>
  {error?<div className={styles.error}>{error}</div>:<section className={styles.groups}><div className={styles.count}>{groups.length} evidence groups · {visibleNotes.length} of {notes.length} notes</div>{groups.map(group=><details key={group.key}><summary><span>▸</span><div className={styles.groupIdentity}><b>{group.topic}</b><small>{group.system}</small></div><div className={styles.flags}>{group.flags.map(flag=><em key={flag}>{flag}</em>)}</div><div className={`${styles.state} ${group.state==='Unresolved'?styles.unresolved:group.state==='Linked'?styles.linked:styles.reviewed}`}>{group.state}</div><strong>{group.notes.length}</strong></summary><div>{group.notes.map(note=><article key={note.id}><div className={styles.itemHead}><div><b>{note.source_type}</b><span>{note.source_reference||'No source reference'}</span></div><span>{note.disposition||'Unreviewed'}</span></div><p>{note.observation}</p><footer><b>Topic</b><span>{note.topic||'Untitled Topic'}</span>{note.linked_master_finding_id?<><b>Linked SLR</b><span>{findingLabel(note.linked_master_finding_id)}</span></>:null}</footer></article>)}</div></details>)}{!groups.length?<div className={styles.empty}>No evidence groups match the current filters.</div>:null}</section>}
 </main>;
}
