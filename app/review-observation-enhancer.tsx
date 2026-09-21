'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';

type ActionFlag='RFI'|'GC Clarification'|'Contractor Clarification'|'ScopeLogic Clarification'|'VE Potential';
type Note={id:string;system_name:string;topic:string;source_type:string;source_reference:string;observation:string;disposition:string;linked_master_finding_id:string|null;action_flags?:ActionFlag[];created_at:string};
type Finding={id:string;display_number:string;scope_item:string;systems:string[];sequence_number:number};
type Identity={ownerId:string;actualUserId:string};
type Group={key:string;system:string;topic:string;notes:Note[];flags:ActionFlag[];state:'Unresolved'|'Reviewed'|'Linked'|'SLR Draft'};
type ReviewTab='capture'|'groups';

const ACTION_FLAGS:ActionFlag[]=['RFI','GC Clarification','Contractor Clarification','ScopeLogic Clarification','VE Potential'];
const SOURCE_TYPES=['Specification','Drawing','Addendum','RFI Response','Meeting','Field Observation','Proposal','Other'];
const DEFAULT_SYSTEMS=['Structured Cabling','Network Electronics','CCTV','Access Control','Intrusion Detection','Fire Alarm','Video Intercom','Audio Visual','Paging / Intercom','Other'];
const text=(value:unknown)=>String(value??'').trim();
const groupKey=(system:string,topic:string)=>`${system.trim().toLowerCase()}::${topic.trim().toLowerCase()}`;

function groupState(notes:Note[]):Group['state']{
 if(notes.length&&notes.every(note=>note.disposition==='No Action'))return 'Reviewed';
 if(notes.length&&notes.every(note=>Boolean(note.linked_master_finding_id))){return notes.some(note=>note.disposition==='SLR')?'SLR Draft':'Linked';}
 return 'Unresolved';
}

function CaptureGroupResolve({masterId}:{masterId:string}){
 const supabase=useMemo(()=>createClient() as any,[]);
 const [tab,setTab]=useState<ReviewTab>('capture');
 const [notes,setNotes]=useState<Note[]>([]);const [findings,setFindings]=useState<Finding[]>([]);const [projectSystems,setProjectSystems]=useState<string[]>([]);
 const [search,setSearch]=useState('');const [systemFilter,setSystemFilter]=useState('All');const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [capture,setCapture]=useState({system_name:'Structured Cabling',topic:'',source_type:'Specification',source_reference:'',observation:'',action_flags:[] as ActionFlag[]});
 const [selectedGroup,setSelectedGroup]=useState('');const [resolution,setResolution]=useState<'none'|'existing'|'new'>('none');const [existingFindingId,setExistingFindingId]=useState('');

 const load=useCallback(async()=>{
  const [n,f,m]=await Promise.all([
   supabase.from('master_project_review_notes').select('id,system_name,topic,source_type,source_reference,observation,disposition,linked_master_finding_id,action_flags,created_at').eq('master_project_id',masterId).order('created_at',{ascending:false}),
   supabase.from('master_project_findings').select('id,display_number,scope_item,systems,sequence_number').eq('master_project_id',masterId).order('sequence_number'),
   supabase.from('master_projects').select('systems').eq('id',masterId).maybeSingle(),
  ]);
  const failure=n.error||f.error||m.error;if(failure){setError(failure.message||'Review workflow data could not be loaded.');return;}
  setError('');setNotes((n.data||[]).map((item:any)=>({...item,action_flags:Array.isArray(item.action_flags)?item.action_flags:[]})) as Note[]);
  setFindings((f.data||[]).map((item:any)=>({...item,systems:Array.isArray(item.systems)?item.systems:[]})) as Finding[]);
  setProjectSystems(Array.isArray(m.data?.systems)?m.data.systems:[]);
 },[masterId,supabase]);
 useEffect(()=>{void load();const focus=()=>void load();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[load]);

 const systems=useMemo(()=>Array.from(new Set([...projectSystems,...DEFAULT_SYSTEMS,...notes.map(n=>text(n.system_name))].filter(Boolean))),[notes,projectSystems]);
 const groups=useMemo(()=>{
  const map=new Map<string,Note[]>();for(const note of notes){const key=groupKey(note.system_name,note.topic);map.set(key,[...(map.get(key)||[]),note]);}
  return [...map.entries()].map(([key,items]):Group=>({
   key,system:text(items[0]?.system_name)||'Other',topic:text(items[0]?.topic)||'Untitled Topic',notes:items,
   flags:Array.from(new Set(items.flatMap(item=>item.action_flags||[]))) as ActionFlag[],state:groupState(items),
  })).sort((a,b)=>a.system.localeCompare(b.system,undefined,{numeric:true})||a.topic.localeCompare(b.topic,undefined,{numeric:true}));
 },[notes]);
 const visibleGroups=useMemo(()=>{const needle=search.trim().toLowerCase();return groups.filter(group=>(systemFilter==='All'||group.system===systemFilter)&&(!needle||[group.system,group.topic,...group.notes.flatMap(note=>[note.source_type,note.source_reference,note.observation,...(note.action_flags||[])])].join(' ').toLowerCase().includes(needle)))},[groups,search,systemFilter]);
 const activeGroup=groups.find(group=>group.key===selectedGroup)||null;

 const identity=useCallback(async():Promise<Identity>=>{
  const result=await supabase.auth.getUser();if(result.error||!result.data?.user)throw new Error('Your ScopeLogic session is not available. Sign in again.');
  const user=result.data.user;const metadata=user.app_metadata||{};
  return {ownerId:String(metadata.scopelogic_workspace_owner_id||user.id),actualUserId:String(metadata.scopelogic_actual_user_id||user.id)};
 },[supabase]);
 const toggleFlag=(flag:ActionFlag)=>setCapture(current=>({...current,action_flags:current.action_flags.includes(flag)?current.action_flags.filter(item=>item!==flag):[...current.action_flags,flag]}));

 const saveAndNew=async()=>{
  if(!capture.topic.trim()||!capture.observation.trim()){setError('Topic and Observation are required.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const ids=await identity();const result=await supabase.from('master_project_review_notes').insert({owner_id:ids.ownerId,master_project_id:masterId,created_by_user_id:ids.actualUserId,system_name:capture.system_name,topic:capture.topic.trim(),source_type:capture.source_type,source_reference:capture.source_reference.trim(),observation:capture.observation.trim(),action_flags:capture.action_flags,disposition:'Unreviewed',linked_master_finding_id:null});
   if(result.error)throw new Error(result.error.message);
   setCapture(current=>({...current,source_reference:'',observation:'',action_flags:[]}));await load();setMessage('Review Note saved. System, Topic, and Source Type were retained for the next observation.');
  }catch(cause){setError(cause instanceof Error?cause.message:'The Review Note could not be saved.');}finally{setBusy(false);}
 };

 const updateGroupNotes=async(group:Group,payload:Record<string,unknown>)=>{
  for(const note of group.notes){const result=await supabase.from('master_project_review_notes').update({...payload,updated_at:new Date().toISOString()}).eq('id',note.id);if(result.error)throw new Error(result.error.message);}
 };
 const resolveNoAction=async()=>{
  if(!activeGroup)return;setBusy(true);setError('');
  try{await updateGroupNotes(activeGroup,{disposition:'No Action',linked_master_finding_id:null});setSelectedGroup('');setResolution('none');await load();setMessage(`${activeGroup.system} / ${activeGroup.topic} marked reviewed with no further action.`);}catch(cause){setError(cause instanceof Error?cause.message:'The evidence group could not be resolved.');}finally{setBusy(false);}
 };
 const linkExisting=async()=>{
  if(!activeGroup||!existingFindingId){setError('Select the existing SLR that should receive this evidence.');return;}setBusy(true);setError('');
  try{await updateGroupNotes(activeGroup,{disposition:'Linked to SLR',linked_master_finding_id:existingFindingId});const finding=findings.find(item=>item.id===existingFindingId);setSelectedGroup('');setResolution('none');setExistingFindingId('');await load();setMessage(`Evidence linked to ${finding?.display_number||'the selected SLR'}.`);}catch(cause){setError(cause instanceof Error?cause.message:'The evidence could not be linked to the SLR.');}finally{setBusy(false);}
 };
 const createSlr=async()=>{
  if(!activeGroup)return;setBusy(true);setError('');
  try{
   const ids=await identity();const nextSequence=Math.max(0,...findings.map(item=>Number(item.sequence_number)||Number(item.display_number.replace(/\D/g,''))||0))+1;const display=`SLR-${String(nextSequence).padStart(3,'0')}`;
   const observations=activeGroup.notes.map(note=>note.observation.trim()).filter(Boolean);const references=Array.from(new Set(activeGroup.notes.map(note=>note.source_reference.trim()).filter(Boolean)));const sources=Array.from(new Set(activeGroup.notes.map(note=>note.source_type.trim()).filter(Boolean)));
   const created=await supabase.from('master_project_findings').insert({owner_id:ids.ownerId,master_project_id:masterId,legacy_uid:crypto.randomUUID(),sequence_number:nextSequence,display_number:display,systems:[activeGroup.system],scope_item:activeGroup.topic,status:'Open',scope_concern:observations.join('\n\n'),reference:references.join('; '),source_type:sources.join('; '),recommended_bid_basis:'',recommended_bid_basis_by_system:{},rfi_question:'',reason_basis:'',include_sow:true,include_clarification:true,include_formal_rfi:false,checklist_scope_item:''}).select('id,display_number').single();
   if(created.error||!created.data?.id)throw new Error(created.error?.message||'The new SLR could not be created.');
   await updateGroupNotes(activeGroup,{disposition:'SLR',linked_master_finding_id:created.data.id});setSelectedGroup('');setResolution('none');await load();setMessage(`${created.data.display_number||display} created from the grouped evidence. Action flags remain potential follow-up only; no client deliverable was automatically issued.`);
  }catch(cause){setError(cause instanceof Error?cause.message:'The SLR could not be created.');}finally{setBusy(false);}
 };

 const openResolve=(group:Group)=>{setSelectedGroup(group.key);setResolution('none');setExistingFindingId(group.notes.find(note=>note.linked_master_finding_id)?.linked_master_finding_id||'');};

 return <section className="sl-review-workflow">
  <div className="sl-review-workflow-strip"><b className={tab==='capture'?'active':''}>1 · Capture</b><span>→</span><b className={tab==='groups'?'active':''}>2 · Group</b><span>→</span><b>3 · Resolve</b></div>
  <div className="sl-review-tabs"><button type="button" className={tab==='capture'?'active':''} onClick={()=>setTab('capture')}>Quick Capture</button><button type="button" className={tab==='groups'?'active':''} onClick={()=>setTab('groups')}>Evidence Groups <span>{groups.length}</span></button><button type="button" onClick={()=>void load()}>Refresh</button></div>
  {error?<div className="sl-review-workflow-error">{error}<button type="button" onClick={()=>setError('')}>×</button></div>:null}{message?<div className="sl-review-workflow-message">{message}<button type="button" onClick={()=>setMessage('')}>×</button></div>:null}

  {tab==='capture'?<div className="sl-review-capture">
   <div className="sl-review-capture-grid"><label><span>System</span><select value={capture.system_name} onChange={e=>setCapture({...capture,system_name:e.target.value})}>{systems.map(item=><option key={item}>{item}</option>)}</select></label><label><span>Topic</span><input list="sl-review-topics" value={capture.topic} onChange={e=>setCapture({...capture,topic:e.target.value})} placeholder="e.g. Existing access control integration"/><datalist id="sl-review-topics">{Array.from(new Set(notes.map(note=>note.topic).filter(Boolean))).map(item=><option key={item} value={item}/>)}</datalist></label><label><span>Source Type</span><select value={capture.source_type} onChange={e=>setCapture({...capture,source_type:e.target.value})}>{SOURCE_TYPES.map(item=><option key={item}>{item}</option>)}</select></label><label><span>Source Reference</span><input value={capture.source_reference} onChange={e=>setCapture({...capture,source_reference:e.target.value})} placeholder="Sheet, detail, spec section, page…"/></label><label className="wide"><span>Observation</span><textarea rows={3} value={capture.observation} onChange={e=>setCapture({...capture,observation:e.target.value})} placeholder="Capture what the document says or what you observed. Do not synthesize the final SLR yet."/></label></div>
   <div className="sl-review-action-flags"><div><b>Potential Follow-Up</b><small>Optional and multi-select. These flags do not issue a deliverable.</small></div><div>{ACTION_FLAGS.map(flag=><label key={flag} className={capture.action_flags.includes(flag)?'selected':''}><input type="checkbox" checked={capture.action_flags.includes(flag)} onChange={()=>toggleFlag(flag)}/><span>{flag}</span></label>)}</div></div>
   <div className="sl-review-capture-footer"><small>Save & New keeps System, Topic, and Source Type so you can continue reading without re-entering context.</small><button type="button" className="primary" disabled={busy||!capture.topic.trim()||!capture.observation.trim()} onClick={()=>void saveAndNew()}>{busy?'Saving…':'Save & New'}</button></div>
  </div>:null}

  {tab==='groups'?<div className="sl-review-evidence">
   <div className="sl-review-grouped-controls"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search evidence, topics, references…"/><select value={systemFilter} onChange={e=>setSystemFilter(e.target.value)}><option value="All">All Systems</option>{systems.map(item=><option key={item}>{item}</option>)}</select><div className="sl-review-count">{visibleGroups.length} groups · {notes.length} notes</div></div>
   {visibleGroups.length?<div className="sl-review-groups">{visibleGroups.map(group=><details key={group.key} open={group.key===selectedGroup}><summary><span>▸</span><div><b>{group.topic}</b><small>{group.system}</small></div><div className={`sl-review-state ${group.state.toLowerCase().replace(/\s+/g,'-')}`}>{group.state}</div><strong>{group.notes.length}</strong></summary><div className="sl-review-group-body"><div className="sl-review-group-actions">{group.flags.length?<div>{group.flags.map(flag=><span key={flag}>{flag}</span>)}</div>:<small>No potential follow-up flags selected.</small>}<button type="button" onClick={()=>openResolve(group)}>Resolve Group</button></div><div className="sl-review-group-items">{group.notes.map(note=><article key={note.id}><header><b>{note.source_type}</b><span>{note.source_reference||'No source reference'}</span></header><p>{note.observation}</p><footer><span>{note.disposition||'Unreviewed'}</span>{note.linked_master_finding_id?<span>{findings.find(item=>item.id===note.linked_master_finding_id)?.display_number||'Linked SLR'}</span>:null}</footer></article>)}</div>{group.key===selectedGroup?<div className="sl-review-resolve"><div><b>Resolve Evidence Group</b><small>Choose what happens after the evidence has been reviewed together.</small></div><div className="sl-review-resolve-choices"><label className={resolution==='none'?'selected':''}><input type="radio" name="review-resolution" checked={resolution==='none'} onChange={()=>setResolution('none')}/><span>No further action</span></label><label className={resolution==='existing'?'selected':''}><input type="radio" name="review-resolution" checked={resolution==='existing'} onChange={()=>setResolution('existing')}/><span>Add Evidence to Existing SLR</span></label><label className={resolution==='new'?'selected':''}><input type="radio" name="review-resolution" checked={resolution==='new'} onChange={()=>setResolution('new')}/><span>Create New SLR</span></label></div>{resolution==='existing'?<label className="sl-review-existing"><span>Existing SLR</span><select value={existingFindingId} onChange={e=>setExistingFindingId(e.target.value)}><option value="">Select SLR…</option>{findings.map(item=><option key={item.id} value={item.id}>{item.display_number} — {item.scope_item}</option>)}</select></label>:null}{resolution==='new'?<div className="sl-review-new-summary"><b>New SLR draft</b><span>{group.system} · {group.topic}</span><small>{group.notes.length} evidence items and their references will be consolidated into the new SLR. Potential follow-up flags will remain internal indicators; they will not auto-issue documents.</small></div>:null}<div className="sl-review-resolve-footer"><button type="button" onClick={()=>{setSelectedGroup('');setResolution('none')}}>Cancel</button>{resolution==='none'?<button type="button" className="primary" disabled={busy} onClick={()=>void resolveNoAction()}>Mark Reviewed</button>:resolution==='existing'?<button type="button" className="primary" disabled={busy||!existingFindingId} onClick={()=>void linkExisting()}>Link Evidence</button>:<button type="button" className="primary" disabled={busy} onClick={()=>void createSlr()}>Create SLR</button>}</div></div>:null}</div></details>)}</div>:<div className="sl-review-grouped-empty">No evidence groups match the current filters.</div>}
  </div>:null}
 </section>;
}

export default function ReviewObservationEnhancer(){
 const [mount,setMount]=useState<HTMLElement|null>(null);const [masterId,setMasterId]=useState('');
 useEffect(()=>{let queued=false;const install=()=>{const match=window.location.pathname.match(/^\/master-projects\/([^/]+)\/deliverables\/?$/);if(!match){setMount(null);return false}setMasterId(match[1]);const title=Array.from(document.querySelectorAll('h2')).find(node=>node.textContent?.trim()==='Review Notes');if(!title){setMount(null);return false}const workspace=title.closest('section');if(!workspace)return false;const head=title.parentElement?.parentElement as HTMLElement|null;const subtitle=title.parentElement?.querySelector('p');if(subtitle)subtitle.textContent='Capture raw evidence first, group it by System + Topic, then resolve it into no action, an existing SLR, or a new SLR.';
 const oldAction=head?Array.from(head.querySelectorAll<HTMLButtonElement>('button')).find(button=>/Add Review Note/i.test(button.textContent||'')):undefined;if(oldAction)oldAction.style.display='none';
 let host=workspace.querySelector<HTMLElement>('[data-grouped-review-host]');if(!host){host=document.createElement('div');host.dataset.groupedReviewHost='true';const original=Array.from(workspace.querySelectorAll<HTMLElement>('div')).find(el=>el.className.includes('cards')&&el.querySelector('article'));if(original){original.style.display='none';original.dataset.originalReviewList='true';original.before(host)}else head?.after(host)}setMount(host);return true};
 const refresh=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;install()})};refresh();const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);
 if(!mount||!masterId)return null;return createPortal(<CaptureGroupResolve masterId={masterId}/>,mount);
}
