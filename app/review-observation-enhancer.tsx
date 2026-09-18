'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';

type Note={id:string;system_name:string;topic:string;source_type:string;source_reference:string;observation:string;disposition:string;created_at:string};
type GroupBy='system'|'topic'|'source';

const text=(value:unknown)=>String(value??'').trim();
const keyFor=(note:Note,groupBy:GroupBy)=>groupBy==='topic'?(text(note.topic)||'No Topic'):groupBy==='source'?(text(note.source_type)||'No Source Type'):(text(note.system_name)||'No System');

function GroupedReview({masterId}:{masterId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [notes,setNotes]=useState<Note[]>([]);const [search,setSearch]=useState('');const [system,setSystem]=useState('All');const [groupBy,setGroupBy]=useState<GroupBy>('system');const [error,setError]=useState('');
 const load=useCallback(async()=>{const result=await supabase.from('master_project_review_notes').select('id,system_name,topic,source_type,source_reference,observation,disposition,created_at').eq('master_project_id',masterId).order('created_at',{ascending:false});if(result.error){setError(result.error.message);return;}setError('');setNotes((result.data||[]) as Note[])},[masterId,supabase]);
 useEffect(()=>{void load();const focus=()=>void load();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[load]);
 const systems=useMemo(()=>Array.from(new Set(notes.map(n=>text(n.system_name)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[notes]);
 const visible=useMemo(()=>{const needle=search.trim().toLowerCase();return notes.filter(n=>(system==='All'||n.system_name===system)&&(!needle||[n.system_name,n.topic,n.source_type,n.source_reference,n.observation,n.disposition].join(' ').toLowerCase().includes(needle)))},[notes,search,system]);
 const groups=useMemo(()=>{const map=new Map<string,Note[]>();for(const note of visible){const key=keyFor(note,groupBy);map.set(key,[...(map.get(key)||[]),note])}return [...map.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))},[visible,groupBy]);
 const popout=()=>window.open(`/master-projects/${masterId}/review-observations`,'scopelogic-review-observations','popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes');
 return <section className="sl-review-grouped-panel">
  <div className="sl-review-grouped-head"><div><span>GROUPED OBSERVATIONS</span><b>Review Reference</b><small>{visible.length} of {notes.length} observations</small></div><div><button type="button" onClick={()=>void load()}>Refresh</button><button type="button" className="primary" onClick={popout}>Pop Out Review</button></div></div>
  <div className="sl-review-grouped-controls"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search observations, references, topics…"/><select value={system} onChange={e=>setSystem(e.target.value)}><option value="All">All Systems</option>{systems.map(x=><option key={x}>{x}</option>)}</select><select value={groupBy} onChange={e=>setGroupBy(e.target.value as GroupBy)}><option value="system">Group by System</option><option value="topic">Group by Topic</option><option value="source">Group by Source Type</option></select></div>
  {error?<div className="sl-review-grouped-error">{error}</div>:groups.length?<div className="sl-review-groups">{groups.map(([key,items])=><details key={key}><summary><span>▸</span><b>{key}</b><small>{items.length}</small></summary><div className="sl-review-group-items">{items.map(n=><article key={n.id}><div><b>{n.topic||'Untitled Observation'}</b><span>{n.system_name} · {n.source_type}</span></div><p>{n.observation}</p><footer><span>{n.source_reference||'No source reference'}</span><span>{n.disposition||'Unreviewed'}</span></footer></article>)}</div></details>)}</div>:<div className="sl-review-grouped-empty">No review observations match the current filters.</div>}
  <div className="sl-review-grouped-note">Observations are reference material only. Create SLRs manually in the Internal Review Matrix.</div>
 </section>;
}

export default function ReviewObservationEnhancer(){
 const [mount,setMount]=useState<HTMLElement|null>(null);const [masterId,setMasterId]=useState('');
 useEffect(()=>{let queued=false;const install=()=>{const match=window.location.pathname.match(/^\/master-projects\/([^/]+)\/deliverables\/?$/);if(!match){setMount(null);return false}setMasterId(match[1]);const title=Array.from(document.querySelectorAll('h2')).find(node=>node.textContent?.trim()==='Review Notes');if(!title){setMount(null);return false}const workspace=title.closest('section');if(!workspace)return false;const head=title.parentElement?.parentElement as HTMLElement|null;const subtitle=title.parentElement?.querySelector('p');if(subtitle)subtitle.textContent='Capture and group source observations here. SLRs are created manually in the Internal Review Matrix.';
 let host=workspace.querySelector<HTMLElement>('[data-grouped-review-host]');if(!host){host=document.createElement('div');host.dataset.groupedReviewHost='true';const original=Array.from(workspace.querySelectorAll<HTMLElement>('div')).find(el=>el.className.includes('cards')&&el.querySelector('article'));if(original){original.style.display='none';original.dataset.originalReviewList='true';original.before(host)}else head?.after(host)}setMount(host);
 const relatedLabels=Array.from(document.querySelectorAll<HTMLLabelElement>('label')).filter(label=>/^Related SLR\b/i.test(label.textContent?.trim()||''));relatedLabels.forEach(label=>{if(label.closest('[role="dialog"],section'))label.style.display='none'});
 const relatedTerms=Array.from(workspace.querySelectorAll<HTMLElement>('dt')).filter(dt=>dt.textContent?.trim()==='Related SLR');relatedTerms.forEach(dt=>{const row=dt.parentElement;if(row)row.style.display='none'});
 return true};
 const refresh=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;install()})};refresh();const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);
 if(!mount||!masterId)return null;return createPortal(<GroupedReview masterId={masterId}/>,mount);
}
