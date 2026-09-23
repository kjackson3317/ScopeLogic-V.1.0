'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';
import { clearClarificationSuppressionForMasterSlr, suppressClarificationForMasterSlr } from '../lib/cloud-workspace';

type DeliverableTab = 'matrix'|'clarifications'|'rfi'|'ve'|'checklist'|'bid-internal'|'bid-report';
type ActionType = 'RBB'|'CL'|'RFI'|'VE'|'SLC';
type Finding = { id:string; display_number:string; scope_item:string; systems:string[]; status:string };
type Action = { id:string; related_master_finding_id:string|null; deliverable_type:ActionType; sequence_number:number; display_number:string; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_date:string|null; response_source:string; client_facing:boolean; sort_order:number; source_child_uid?:string; source_origin?:string };
type Checklist = { id:string; linked_master_finding_id:string|null; sequence_number:number; display_number:string; category:string; system_name:string; question:string; status:string; response:string; response_reason:string; sort_order:number };
type Bid = { id:string; related_deliverable_id:string|null; bidder_name:string; scope_item:string; proposal_status:string; proposal_reference:string; clarification:string; documented_adjustment:number|null; adjustment_type:string; pricing_source:string; internal_notes:string; client_notes:string; sort_order:number };
type PreviewData = { masterName:string; projectNumber:string; findings:Finding[]; actions:Action[]; checklist:Checklist[]; bids:Bid[] };
type Draft = { type:'CL'|'VE'; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string };

const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8','scopelogic-r14-7','scopelogic-r14-6','scopelogic-r14-5','scopelogic-r14-4','scopelogic-r14-3','scopelogic-r14-2','technology-preconstruction-workspace'];
const LABELS:Record<DeliverableTab,string> = {
  matrix:'Scope Matrix / RBB', clarifications:'GC Clarifications', rfi:'Formal RFI', ve:'VE Opportunities', checklist:'Contractor Scope Confirmation', 'bid-internal':'Bid Alignment', 'bid-report':'Reports / Official Releases',
};
const pad=(value:number)=>String(value).padStart(3,'0');
const text=(value:unknown)=>String(value??'');

function activeLegacyProjectId(){
  for(const key of LOCAL_WORKSPACE_KEYS){
    const raw=window.localStorage.getItem(key); if(!raw) continue;
    try{const snapshot=JSON.parse(raw) as {projectId?:string}; if(snapshot.projectId)return snapshot.projectId;}catch{/* continue */}
  }
  return '';
}

async function resolveMasterId(supabase:any){
  const pathId=window.location.pathname.match(/^\/master-projects\/([^/]+)/)?.[1]||'';
  if(pathId)return pathId;
  const legacyId=activeLegacyProjectId();
  if(legacyId){
    const result=await supabase.from('projects').select('master_project_id').eq('legacy_id',legacyId).maybeSingle();
    if(!result.error&&result.data?.master_project_id)return String(result.data.master_project_id);
  }
  const masters=await supabase.from('master_projects').select('id');
  if(!masters.error&&Array.isArray(masters.data)&&masters.data.length===1)return String(masters.data[0].id);
  return '';
}

function currentSlrId(){
  const labels=Array.from(document.querySelectorAll<HTMLLabelElement>('.matrix-editor-full label.field'));
  const target=labels.find((label)=>label.querySelector('span')?.textContent?.trim()==='SLR ID');
  return target?.querySelector<HTMLInputElement>('input')?.value?.trim()||'';
}

function ensureHost(selector:string,className:string,after?:Element|null){
  let host=document.querySelector<HTMLElement>(selector);
  if(!host){
    host=document.createElement('div'); host.className=className;
    if(after?.parentElement)after.after(host);
    else document.querySelector<HTMLElement>('.app-shell .main')?.appendChild(host);
  }
  if(after?.parentElement&&after.nextElementSibling!==host)after.after(host);
  return host;
}

function relatedSlr(id:string|null, findings:Finding[]){
  return findings.find((item)=>item.id===id)?.display_number||'—';
}

function adjustmentText(item:Bid){
  if(item.documented_adjustment==null)return 'Unpriced';
  const prefix=item.adjustment_type==='Deduct'?'-':item.adjustment_type==='Add'?'+':'';
  return `${prefix}$${Number(item.documented_adjustment).toLocaleString()}`;
}

function PreviewTable({headers,rows}:{headers:string[];rows:(string|number)[][]}){
  return <div className="sl-deliverable-preview-table-wrap"><table className="sl-deliverable-preview-table"><thead><tr>{headers.map((header)=><th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{text(cell)||'—'}</td>)}</tr>):<tr><td colSpan={headers.length} className="sl-empty-deliverable">No items in this deliverable.</td></tr>}</tbody></table></div>;
}

function InlineDeliverablePreview(){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [tab,setTab]=useState<DeliverableTab|null>(null);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [data,setData]=useState<PreviewData|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    if(!tab)return;
    setLoading(true); setError('');
    try{
      const masterId=await resolveMasterId(supabase); if(!masterId)throw new Error('No active Master Project could be resolved for this deliverable preview.');
      const [master,findings,actions,checklist,bids]=await Promise.all([
        supabase.from('master_projects').select('id,project_number,name').eq('id',masterId).maybeSingle(),
        supabase.from('master_project_findings').select('id,display_number,scope_item,systems,status').eq('master_project_id',masterId).order('sequence_number'),
        supabase.from('master_project_deliverable_items').select('*').eq('master_project_id',masterId).order('deliverable_type').order('sequence_number'),
        supabase.from('master_project_checklist_items').select('*').eq('master_project_id',masterId).order('sequence_number'),
        supabase.from('master_project_bid_alignment_items').select('*').eq('master_project_id',masterId).order('bidder_name').order('sort_order'),
      ]);
      const failure=master.error||findings.error||actions.error||checklist.error||bids.error; if(failure)throw new Error(failure.message||'Deliverable data could not be loaded.');
      setData({masterName:text(master.data?.name),projectNumber:text(master.data?.project_number),findings:(findings.data||[]) as Finding[],actions:(actions.data||[]) as Action[],checklist:(checklist.data||[]) as Checklist[],bids:(bids.data||[]) as Bid[]});
    }catch(cause){setError(cause instanceof Error?cause.message:'Deliverable data could not be loaded.');setData(null);}finally{setLoading(false);}
  },[supabase,tab]);

  useEffect(()=>{if(tab)void load();},[tab,load]);
  useEffect(()=>{
    const open=(event:Event)=>{
      const detail=(event as CustomEvent<{tab:DeliverableTab}>).detail; if(!detail?.tab)return;
      const main=document.querySelector<HTMLElement>('.app-shell .main'); if(!main)return;
      const topbar=main.querySelector(':scope > .topbar');
      const nextHost=ensureHost('.sl-inline-deliverables-host','sl-inline-deliverables-host',topbar);
      setHost(nextHost); setTab(detail.tab); document.body.classList.add('sl-deliverable-preview-open');
    };
    const close=()=>{setTab(null);document.body.classList.remove('sl-deliverable-preview-open');document.querySelectorAll('.sl-deliverable-nav-link.active').forEach((node)=>node.classList.remove('active'));};
    window.addEventListener('scopelogic:deliverable-preview',open as EventListener);
    window.addEventListener('scopelogic:close-deliverable-preview',close);
    return()=>{window.removeEventListener('scopelogic:deliverable-preview',open as EventListener);window.removeEventListener('scopelogic:close-deliverable-preview',close);document.body.classList.remove('sl-deliverable-preview-open');};
  },[]);

  if(!tab||!host)return null;
  const actions=data?.actions||[], findings=data?.findings||[], checklist=data?.checklist||[], bids=data?.bids||[];
  let content=<></>;
  if(tab==='matrix'){
    const rows=actions.filter((x)=>x.deliverable_type==='RBB'&&x.client_facing!==false).map((x)=>[x.display_number,relatedSlr(x.related_master_finding_id,findings),x.system_name,x.title,x.content,x.reference,x.status]);
    content=<PreviewTable headers={['RBB','SLR','System','Scope Item','Recommended Base Bid','Reference','Status']} rows={rows}/>;
  }else if(tab==='clarifications'){
    const rows=actions.filter((x)=>x.deliverable_type==='CL'&&x.client_facing!==false).map((x)=>[x.display_number,relatedSlr(x.related_master_finding_id,findings),x.system_name,x.title,x.content,x.reference,x.status,x.response]);
    content=<PreviewTable headers={['CL','SLR','System','Subject','GC Clarification','Reference','Status','Response']} rows={rows}/>;
  }else if(tab==='rfi'){
    const rows=actions.filter((x)=>x.deliverable_type==='RFI'&&x.client_facing!==false).map((x)=>[x.display_number,relatedSlr(x.related_master_finding_id,findings),x.system_name,x.title,x.content,x.reference,x.status,x.response]);
    content=<PreviewTable headers={['RFI','SLR','System','Subject','Question','Reference','Status','Response']} rows={rows}/>;
  }else if(tab==='ve'){
    const rows=actions.filter((x)=>x.deliverable_type==='VE'&&x.client_facing!==false).map((x)=>[x.display_number,relatedSlr(x.related_master_finding_id,findings),x.system_name,x.title,x.content,x.impact_considerations,x.reference,x.status]);
    content=<PreviewTable headers={['VE','SLR','System','Opportunity','VE Basis','Impact / Considerations','Reference','Status']} rows={rows}/>;
  }else if(tab==='checklist'){
    const rows=checklist.map((x)=>[x.display_number,relatedSlr(x.linked_master_finding_id,findings),x.system_name,x.question,x.response,x.response_reason,x.status]);
    content=<PreviewTable headers={['CSC','SLR','System','Contractor Scope Confirmation','Response','Notes','Status']} rows={rows}/>;
  }else if(tab==='bid-internal'){
    const actionMap=new Map(actions.map((x)=>[x.id,x]));
    const rows=bids.map((x)=>[x.bidder_name,x.scope_item,actionMap.get(x.related_deliverable_id||'')?.display_number||'—',x.proposal_status,x.proposal_reference,x.clarification,adjustmentText(x),x.pricing_source]);
    content=<PreviewTable headers={['Bidder','Scope Item','RBB / Source','Alignment','Proposal Reference','Clarification','Documented Adjustment','Pricing Source']} rows={rows}/>;
  }else{
    const actionMap=new Map(actions.map((x)=>[x.id,x]));
    const rows=bids.map((x)=>[x.bidder_name,x.scope_item,actionMap.get(x.related_deliverable_id||'')?.display_number||'—',x.proposal_status,adjustmentText(x),x.client_notes]);
    content=<><PreviewTable headers={['Bidder','Scope Item','RBB / Source','Alignment','Documented Adjustment','Client Note']} rows={rows}/><div className="sl-release-note"><b>Official Releases</b><span>Issued files remain immutable under Project Control → Official Releases. This view is read-only.</span></div></>;
  }
  return createPortal(<section className="sl-deliverable-preview"><header><div><span>READ-ONLY DELIVERABLE PREVIEW</span><h1>{LABELS[tab]}</h1><p>{data?`${data.projectNumber} · ${data.masterName}`:'Loading project…'}</p></div><div className="sl-preview-actions"><button type="button" onClick={()=>void load()}>Refresh</button><button type="button" className="primary" onClick={()=>window.dispatchEvent(new Event('scopelogic:close-deliverable-preview'))}>Close Preview</button></div></header>{loading?<div className="sl-preview-state">Loading deliverable items…</div>:error?<div className="sl-preview-state error">{error}</div>:content}</section>,host);
}

function DeliverableEditorRow({item,masterId,slrId,onSaved,onDeleted,onMessage}:{item:Action;masterId:string;slrId:string;onSaved:(item:Action)=>void;onDeleted:(id:string)=>void;onMessage:(message:string)=>void}){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [draft,setDraft]=useState<Action>({...item}); const [saving,setSaving]=useState(false); const [confirmDelete,setConfirmDelete]=useState(false); const isVe=item.deliverable_type==='VE';
  useEffect(()=>{setDraft({...item});setConfirmDelete(false);},[item]);
  const save=async()=>{
    setSaving(true);
    const payload={system_name:draft.system_name,title:draft.title.trim(),content:draft.content.trim(),impact_considerations:draft.impact_considerations.trim(),reference:draft.reference.trim(),status:draft.status,response:draft.response.trim(),response_source:draft.response_source.trim(),updated_at:new Date().toISOString()};
    const result=await supabase.from('master_project_deliverable_items').update(payload).eq('id',item.id);
    setSaving(false);
    if(result.error){onMessage(`${item.display_number} save failed: ${result.error.message||'Unknown error.'}`);return;}
    onSaved({...draft,...payload}); onMessage(`${item.display_number} saved successfully.`);
  };
  const remove=async()=>{
    if(!confirmDelete){setConfirmDelete(true);return;}
    const result=await supabase.from('master_project_deliverable_items').delete().eq('id',item.id);
    if(result.error){onMessage(`${item.display_number} delete failed: ${result.error.message||'Unknown error.'}`);return;}
    if(item.deliverable_type==='CL')suppressClarificationForMasterSlr(masterId,slrId);
    onDeleted(item.id); onMessage(`${item.display_number} deleted. It will remain excluded from this SLR unless you explicitly add a GC Clarification again.`);
  };
  return <article className="sl-slr-deliverable-card"><div className="sl-slr-deliverable-card-head"><div><b>{item.display_number}</b><span>{item.deliverable_type==='CL'?'GC Clarification':'VE Opportunity'}</span></div><select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}>{(isVe?['Identified','Proposed','Accepted','Rejected','Closed']:['Draft','Open','Answered','Closed']).map((status)=><option key={status}>{status}</option>)}</select></div><div className="sl-slr-deliverable-grid"><label><span>System</span><input value={draft.system_name} onChange={(e)=>setDraft({...draft,system_name:e.target.value})}/></label><label><span>Title / Subject</span><input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></label><label className="wide"><span>{isVe?'VE Opportunity':'GC Clarification'}</span><textarea rows={3} value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})}/></label>{isVe?<label className="wide"><span>Potential Impact / Considerations</span><textarea rows={2} value={draft.impact_considerations} onChange={(e)=>setDraft({...draft,impact_considerations:e.target.value})}/></label>:<label className="wide"><span>Response / Resolution</span><textarea rows={2} value={draft.response} onChange={(e)=>setDraft({...draft,response:e.target.value})}/></label>}<label className="wide"><span>Document Reference</span><input value={draft.reference} onChange={(e)=>setDraft({...draft,reference:e.target.value})}/></label></div><div className="sl-slr-deliverable-actions">{confirmDelete&&<button type="button" className="secondary" onClick={()=>setConfirmDelete(false)}>Cancel Delete</button>}<button type="button" className="secondary" onClick={remove}>{confirmDelete?'Confirm Delete':'Delete'}</button><button type="button" className="primary" disabled={saving||!draft.title.trim()||!draft.content.trim()} onClick={save}>{saving?'Saving…':'Save'}</button></div></article>;
}

function SlrDeliverablesEditor(){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [host,setHost]=useState<HTMLElement|null>(null); const [slrId,setSlrId]=useState(''); const [masterId,setMasterId]=useState(''); const [finding,setFinding]=useState<Finding|null>(null); const [allActions,setAllActions]=useState<Action[]>([]); const [loading,setLoading]=useState(false); const [newDraft,setNewDraft]=useState<Draft|null>(null); const [message,setMessage]=useState(''); const [clOpen,setClOpen]=useState(true); const [veOpen,setVeOpen]=useState(true);
  const linked=allActions.filter((item)=>item.related_master_finding_id===finding?.id&&['CL','VE'].includes(item.deliverable_type)).sort((a,b)=>a.deliverable_type.localeCompare(b.deliverable_type)||a.sequence_number-b.sequence_number);
  const clarifications=linked.filter((item)=>item.deliverable_type==='CL');
  const veItems=linked.filter((item)=>item.deliverable_type==='VE');

  const load=useCallback(async(nextSlr?:string)=>{
    const target=nextSlr||slrId; if(!target)return; setLoading(true); setMessage('');
    const resolved=await resolveMasterId(supabase); setMasterId(resolved); if(!resolved){setFinding(null);setAllActions([]);setLoading(false);return;}
    const [findingResult,actionsResult]=await Promise.all([
      supabase.from('master_project_findings').select('id,display_number,scope_item,systems,status').eq('master_project_id',resolved).eq('display_number',target).maybeSingle(),
      supabase.from('master_project_deliverable_items').select('*').eq('master_project_id',resolved).order('deliverable_type').order('sequence_number'),
    ]);
    setFinding((findingResult.data||null) as Finding|null); setAllActions((actionsResult.data||[]) as Action[]); setLoading(false);
  },[slrId,supabase]);

  useEffect(()=>{
    let queued=false;
    const refresh=()=>{if(queued)return;queued=true;window.requestAnimationFrame(()=>{queued=false;const editor=document.querySelector<HTMLElement>('.matrix-editor-full .slr-child-editor');const submitBar=document.querySelector<HTMLElement>('.matrix-editor-full .submit-bar');const id=currentSlrId();if(editor&&submitBar){const nextHost=ensureHost('.matrix-editor-full .sl-slr-deliverables-host','sl-slr-deliverables-host',submitBar);setHost(nextHost);}else setHost(null);setSlrId((current)=>{if(id&&id!==current){setClOpen(true);setVeOpen(true);void load(id);return id;}return id||'';});});};
    refresh(); const observer=new MutationObserver(refresh); observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['value','class']}); return()=>observer.disconnect();
  },[load]);

  useEffect(()=>{if(slrId)void load(slrId);},[slrId]);

  const startNew=(type:'CL'|'VE')=>setNewDraft({type,system_name:finding?.systems?.[0]||'',title:finding?.scope_item||'',content:'',impact_considerations:'',reference:'',status:type==='VE'?'Identified':'Draft',response:'',response_source:''});
  const saveNew=async()=>{
    if(!newDraft||!finding||!masterId||!newDraft.title.trim()||!newDraft.content.trim())return;
    const sameType=allActions.filter((item)=>item.deliverable_type===newDraft.type);const seq=Math.max(0,...sameType.map((item)=>Number(item.sequence_number)||0))+1;const userResult=await supabase.auth.getUser();const user=userResult.data?.user;const ownerId=String(user?.app_metadata?.scopelogic_workspace_owner_id||user?.id||'');const actualId=String(user?.app_metadata?.scopelogic_actual_user_id||user?.id||ownerId);const payload={owner_id:ownerId,master_project_id:masterId,created_by_user_id:actualId,related_master_finding_id:finding.id,deliverable_type:newDraft.type,sequence_number:seq,display_number:`${newDraft.type}-${pad(seq)}`,system_name:newDraft.system_name,title:newDraft.title.trim(),content:newDraft.content.trim(),impact_considerations:newDraft.impact_considerations.trim(),reference:newDraft.reference.trim(),status:newDraft.status,response:newDraft.response.trim(),response_date:null,response_source:newDraft.response_source.trim(),client_facing:true,sort_order:seq};
    const result=await supabase.from('master_project_deliverable_items').insert(payload);
    if(result.error){setMessage(`${newDraft.type} save failed: ${result.error.message||'Unknown error.'}`);return;}
    if(newDraft.type==='CL')clearClarificationSuppressionForMasterSlr(masterId,slrId);
    if(newDraft.type==='CL')setClOpen(true); else setVeOpen(true);
    setNewDraft(null);setMessage(`${payload.display_number} saved to ${slrId}.`);await load(slrId);
  };

  if(!host||!slrId)return null;
  return createPortal(<section className="sl-slr-deliverables"><div className="sl-slr-deliverables-heading"><div><span>SLR DELIVERABLES</span><h3>GC Clarifications & VE Opportunities</h3><p>These items are editable only from their originating SLR. The Deliverables menu is read-only preview.</p></div><div><button type="button" className="secondary" onClick={()=>startNew('CL')}>+ GC Clarification</button><button type="button" className="secondary" onClick={()=>startNew('VE')}>+ VE Opportunity</button></div></div>{loading?<div className="sl-preview-state">Loading linked deliverables…</div>:!finding?<div className="sl-preview-state">Submit the SLR first, then reopen it to add GC Clarifications or VE Opportunities.</div>:<>{message&&<div className="sl-slr-message">{message}</div>}{newDraft&&<article className="sl-slr-deliverable-card new"><div className="sl-slr-deliverable-card-head"><div><b>NEW {newDraft.type}</b><span>{newDraft.type==='CL'?'GC Clarification':'VE Opportunity'}</span></div><button type="button" className="secondary" onClick={()=>setNewDraft(null)}>Cancel</button></div><div className="sl-slr-deliverable-grid"><label><span>System</span><input value={newDraft.system_name} onChange={(e)=>setNewDraft({...newDraft,system_name:e.target.value})}/></label><label><span>Title / Subject</span><input value={newDraft.title} onChange={(e)=>setNewDraft({...newDraft,title:e.target.value})}/></label><label className="wide"><span>{newDraft.type==='VE'?'VE Opportunity':'GC Clarification'}</span><textarea rows={3} value={newDraft.content} onChange={(e)=>setNewDraft({...newDraft,content:e.target.value})}/></label>{newDraft.type==='VE'?<label className="wide"><span>Potential Impact / Considerations</span><textarea rows={2} value={newDraft.impact_considerations} onChange={(e)=>setNewDraft({...newDraft,impact_considerations:e.target.value})}/></label>:<label className="wide"><span>Response / Resolution</span><textarea rows={2} value={newDraft.response} onChange={(e)=>setNewDraft({...newDraft,response:e.target.value})}/></label>}<label className="wide"><span>Document Reference</span><input value={newDraft.reference} onChange={(e)=>setNewDraft({...newDraft,reference:e.target.value})}/></label></div><div className="sl-slr-deliverable-actions"><button type="button" className="primary" disabled={!newDraft.title.trim()||!newDraft.content.trim()} onClick={saveNew}>Save to SLR</button></div></article>}{clarifications.length>0&&<><div className="sl-slr-subhead"><span>GC Clarifications</span><button type="button" className="secondary" onClick={()=>setClOpen((value)=>!value)} aria-expanded={clOpen}>{clOpen?'Collapse':'Expand'}</button></div>{clOpen&&clarifications.map((item)=><DeliverableEditorRow key={item.id} item={item} masterId={masterId} slrId={slrId} onMessage={setMessage} onSaved={(next)=>setAllActions((current)=>current.map((x)=>x.id===next.id?next:x))} onDeleted={(id)=>setAllActions((current)=>current.filter((x)=>x.id!==id))}/>)}</>}{veItems.length>0&&<><div className="sl-slr-subhead"><span>VE Opportunities</span><button type="button" className="secondary" onClick={()=>setVeOpen((value)=>!value)} aria-expanded={veOpen}>{veOpen?'Collapse':'Expand'}</button></div>{veOpen&&veItems.map((item)=><DeliverableEditorRow key={item.id} item={item} masterId={masterId} slrId={slrId} onMessage={setMessage} onSaved={(next)=>setAllActions((current)=>current.map((x)=>x.id===next.id?next:x))} onDeleted={(id)=>setAllActions((current)=>current.filter((x)=>x.id!==id))}/>)}</>}{!linked.length&&!newDraft&&<div className="sl-preview-state">No GC Clarification or VE Opportunity is linked to this SLR yet.</div>}</>}</section>,host);
}

function ReadOnlyDeliverablesGuard(){
  useEffect(()=>{
    const apply=()=>{
      const active=/^\/master-projects\/[^/]+\/deliverables\/?$/.test(window.location.pathname);document.body.classList.toggle('sl-deliverables-readonly-page',active);if(!active)return;
      document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('main input,main textarea,main select').forEach((control)=>{control.disabled=true;});
      document.querySelectorAll<HTMLButtonElement>('main button').forEach((button)=>{const label=(button.textContent||'').trim();if(/^(Add|Edit|Delete|Save)/i.test(label)&&!/Print \/ Save PDF/i.test(label)){button.hidden=true;button.disabled=true;}});
    };
    apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();document.body.classList.remove('sl-deliverables-readonly-page');};
  },[]);return null;
}

export default function SlrDeliverablesWorkflow(){return <><InlineDeliverablePreview/><SlrDeliverablesEditor/><ReadOnlyDeliverablesGuard/></>;}