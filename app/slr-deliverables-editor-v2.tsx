'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';
import { clearClarificationSuppressionForMasterSlr, suppressClarificationForMasterSlr } from '../lib/cloud-workspace';
import { resolveSlrProjectContext } from '../lib/slr-draft-cloud';

type Type = 'CL'|'VE';
type Finding = { id:string; display_number:string; scope_item:string; systems:string[]; status:string };
type Action = { id:string; related_master_finding_id:string|null; deliverable_type:Type; sequence_number:number; display_number:string; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string; sort_order:number };
type DraftAction = { id:string; project_id:string; slr_legacy_uid:string; draft_uid:string; deliverable_type:Type; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string; sort_order:number };
type FormDraft = { type:Type; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string };

const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8','technology-precon-r14-8','technology-precon-r14-7','technology-precon-r14-6','technology-precon-r14-5','technology-precon-r14-4','technology-precon-r14-3','technology-precon-r14-2'];
const clean=(value:unknown)=>String(value??'').trim();

function activeLegacyProjectId(){
  for(const key of LOCAL_WORKSPACE_KEYS){
    const raw=window.localStorage.getItem(key); if(!raw)continue;
    try{const value=clean(JSON.parse(raw)?.projectId); if(value)return value;}catch{}
  }
  return '';
}

function currentSlrId(){
  const labels=Array.from(document.querySelectorAll<HTMLLabelElement>('.matrix-editor-full label.field'));
  const target=labels.find((label)=>clean(label.querySelector('span')?.textContent)==='SLR ID');
  return clean(target?.querySelector<HTMLInputElement>('input')?.value);
}

function currentField(labelText:string){
  const labels=Array.from(document.querySelectorAll<HTMLLabelElement>('.matrix-editor-full label.field'));
  const target=labels.find((label)=>clean(label.querySelector('span')?.textContent)===labelText);
  return clean(target?.querySelector<HTMLInputElement|HTMLTextAreaElement>('input,textarea')?.value);
}

function currentSystem(){
  const checked=document.querySelector<HTMLInputElement>('.matrix-editor-full .system-chip-grid input[type="checkbox"]:checked');
  return clean(checked?.closest('label')?.textContent)||'Other';
}

function makeHost(){
  const matrix=document.querySelector<HTMLElement>('.matrix-editor-full');
  if(!matrix)return null;

  const checklist=matrix.querySelector<HTMLElement>('.slr-checklist-section');
  const bar=matrix.querySelector<HTMLElement>('.submit-bar');

  if(!checklist&&!bar)return null;

  let host=matrix.querySelector<HTMLElement>('.sl-slr-deliverables-v2-host');

  if(!host){
    host=document.createElement('div');
    host.className='sl-slr-deliverables-v2-host';
  }

  if(checklist?.parentElement){
    if(host.nextElementSibling!==checklist) checklist.before(host);
  }else if(bar?.parentElement){
    if(host.nextElementSibling!==bar) bar.before(host);
  }

  return host;
}

function defaultForm(type:Type):FormDraft{
  return {type,system_name:currentSystem(),title:currentField('Scope Item / Short Description')||currentField('Topic')||'',content:'',impact_considerations:'',reference:currentField('Source Reference')||'',status:type==='VE'?'Identified':'Draft',response:'',response_source:''};
}

function DraftRow({item,onChanged,onMessage}:{item:DraftAction;onChanged:()=>void;onMessage:(value:string)=>void}){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [draft,setDraft]=useState({...item});
  const [saving,setSaving]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const isVe=item.deliverable_type==='VE';
  useEffect(()=>setDraft({...item}),[item]);
  const save=async()=>{
    setSaving(true);
    const payload={system_name:draft.system_name,title:draft.title.trim(),content:draft.content.trim(),impact_considerations:draft.impact_considerations.trim(),reference:draft.reference.trim(),status:draft.status,response:draft.response.trim(),response_source:draft.response_source.trim(),updated_at:new Date().toISOString()};
    const result=await supabase.from('slr_draft_deliverable_items').update(payload).eq('id',item.id).select('id').maybeSingle();
    setSaving(false);
    if(result.error||!result.data?.id){onMessage(`${isVe?'VE Opportunity':'GC Clarification'} save failed: ${result.error?.message||'Cloud verification failed.'}`);return;}
    onMessage(`${isVe?'VE Opportunity':'GC Clarification'} saved with the SLR draft.`);onChanged();
  };
  const remove=async()=>{
    if(!confirmDelete){setConfirmDelete(true);return;}
    const result=await supabase.from('slr_draft_deliverable_items').delete().eq('id',item.id);
    if(result.error){onMessage(`Delete failed: ${result.error.message}`);return;}
    onMessage(`${isVe?'VE Opportunity':'GC Clarification'} deleted.`);onChanged();
  };
  return <article className="sl-slr-deliverable-card draft-item"><div className="sl-slr-deliverable-card-head"><div><b>DRAFT</b><span>{isVe?'VE Opportunity':'GC Clarification'}</span></div><select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}>{(isVe?['Identified','Proposed','Accepted','Rejected','Closed']:['Draft','Open','Answered','Closed']).map((status)=><option key={status}>{status}</option>)}</select></div><div className="sl-slr-deliverable-grid"><label><span>System</span><input value={draft.system_name} onChange={(e)=>setDraft({...draft,system_name:e.target.value})}/></label><label><span>Title / Subject</span><input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></label><label className="wide"><span>{isVe?'VE Opportunity':'GC Clarification'}</span><textarea rows={3} value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})}/></label>{isVe?<label className="wide"><span>Potential Impact / Considerations</span><textarea rows={2} value={draft.impact_considerations} onChange={(e)=>setDraft({...draft,impact_considerations:e.target.value})}/></label>:<label className="wide"><span>Response / Resolution</span><textarea rows={2} value={draft.response} onChange={(e)=>setDraft({...draft,response:e.target.value})}/></label>}<label className="wide"><span>Document Reference</span><input value={draft.reference} onChange={(e)=>setDraft({...draft,reference:e.target.value})}/></label></div><div className="sl-slr-deliverable-actions">{confirmDelete&&<button type="button" className="secondary" onClick={()=>setConfirmDelete(false)}>Cancel Delete</button>}<button type="button" className="secondary" onClick={remove}>{confirmDelete?'Confirm Delete':'Delete'}</button><button type="button" className="primary" disabled={saving||!draft.title.trim()||!draft.content.trim()} onClick={save}>{saving?'Saving…':'Save'}</button></div></article>;
}

function ActionRow({item,masterId,slrId,onChanged,onMessage}:{item:Action;masterId:string;slrId:string;onChanged:()=>void;onMessage:(value:string)=>void}){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [draft,setDraft]=useState({...item});
  const [saving,setSaving]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const isVe=item.deliverable_type==='VE';
  useEffect(()=>setDraft({...item}),[item]);
  const save=async()=>{
    setSaving(true);
    const payload={system_name:draft.system_name,title:draft.title.trim(),content:draft.content.trim(),impact_considerations:draft.impact_considerations.trim(),reference:draft.reference.trim(),status:draft.status,response:draft.response.trim(),response_source:draft.response_source.trim(),updated_at:new Date().toISOString()};
    const result=await supabase.from('master_project_deliverable_items').update(payload).eq('id',item.id).select('id').maybeSingle();
    setSaving(false);
    if(result.error||!result.data?.id){onMessage(`${item.display_number} save failed: ${result.error?.message||'Cloud verification failed.'}`);return;}
    onMessage(`${item.display_number} saved successfully.`);onChanged();
  };
  const remove=async()=>{
    if(!confirmDelete){setConfirmDelete(true);return;}
    const result=await supabase.from('master_project_deliverable_items').delete().eq('id',item.id);
    if(result.error){onMessage(`${item.display_number} delete failed: ${result.error.message}`);return;}
    if(item.deliverable_type==='CL')suppressClarificationForMasterSlr(masterId,slrId);
    onMessage(`${item.display_number} deleted. It will remain deleted unless you explicitly add another GC Clarification.`);onChanged();
  };
  return <article className="sl-slr-deliverable-card"><div className="sl-slr-deliverable-card-head"><div><b>{item.display_number}</b><span>{isVe?'VE Opportunity':'GC Clarification'}</span></div><select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}>{(isVe?['Identified','Proposed','Accepted','Rejected','Closed']:['Draft','Open','Answered','Closed']).map((status)=><option key={status}>{status}</option>)}</select></div><div className="sl-slr-deliverable-grid"><label><span>System</span><input value={draft.system_name} onChange={(e)=>setDraft({...draft,system_name:e.target.value})}/></label><label><span>Title / Subject</span><input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></label><label className="wide"><span>{isVe?'VE Opportunity':'GC Clarification'}</span><textarea rows={3} value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})}/></label>{isVe?<label className="wide"><span>Potential Impact / Considerations</span><textarea rows={2} value={draft.impact_considerations} onChange={(e)=>setDraft({...draft,impact_considerations:e.target.value})}/></label>:<label className="wide"><span>Response / Resolution</span><textarea rows={2} value={draft.response} onChange={(e)=>setDraft({...draft,response:e.target.value})}/></label>}<label className="wide"><span>Document Reference</span><input value={draft.reference} onChange={(e)=>setDraft({...draft,reference:e.target.value})}/></label></div><div className="sl-slr-deliverable-actions">{confirmDelete&&<button type="button" className="secondary" onClick={()=>setConfirmDelete(false)}>Cancel Delete</button>}<button type="button" className="secondary" onClick={remove}>{confirmDelete?'Confirm Delete':'Delete'}</button><button type="button" className="primary" disabled={saving||!draft.title.trim()||!draft.content.trim()} onClick={save}>{saving?'Saving…':'Save'}</button></div></article>;
}

export default function SlrDeliverablesEditorV2(){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [slrId,setSlrId]=useState('');
  const [projectId,setProjectId]=useState('');
  const [masterId,setMasterId]=useState('');
  const [finding,setFinding]=useState<Finding|null>(null);
  const [actions,setActions]=useState<Action[]>([]);
  const [draftActions,setDraftActions]=useState<DraftAction[]>([]);
  const [message,setMessage]=useState('');
  const [newDraft,setNewDraft]=useState<FormDraft|null>(null);
  const [clOpen,setClOpen]=useState(true);
  const [veOpen,setVeOpen]=useState(true);

  const load=useCallback(async(nextSlr?:string)=>{
    const target=nextSlr||currentSlrId(); if(!target)return;
    try{
      const legacy=activeLegacyProjectId();
      const context=await resolveSlrProjectContext(legacy);
      setProjectId(context.projectId);setMasterId(context.masterProjectId);
      const findingResult=await supabase.from('master_project_findings').select('id,display_number,scope_item,systems,status').eq('master_project_id',context.masterProjectId).eq('display_number',target).maybeSingle();
      if(findingResult.error)throw new Error(findingResult.error.message);
      const nextFinding=(findingResult.data||null) as Finding|null;
      setFinding(nextFinding);
      if(nextFinding){
        const actionResult=await supabase.from('master_project_deliverable_items').select('*').eq('master_project_id',context.masterProjectId).eq('related_master_finding_id',nextFinding.id).in('deliverable_type',['CL','VE']).order('deliverable_type').order('sequence_number');
        if(actionResult.error)throw new Error(actionResult.error.message);
        setActions((actionResult.data||[]) as Action[]);setDraftActions([]);
      }else{
        const draftResult=await supabase.from('slr_draft_deliverable_items').select('*').eq('project_id',context.projectId).eq('slr_legacy_uid',`display:${target}`).order('sort_order').order('created_at');
        if(draftResult.error)throw new Error(draftResult.error.message);
        setDraftActions((draftResult.data||[]) as DraftAction[]);setActions([]);
      }
      setMessage('');
    }catch(cause){setMessage(`GC/VE load failed: ${cause instanceof Error?cause.message:'Unknown cloud error.'}`);}
  },[supabase]);

  useEffect(()=>{
    let frame:number|null=null;
    const timers=new Set<number>();
    const refresh=()=>{
      if(frame!==null)return;
      frame=window.requestAnimationFrame(()=>{
        frame=null;
        setHost(makeHost());
        setSlrId(currentSlrId());
      });
    };
    refresh();const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['value','class']});
    const changed=()=>{
      const timer=window.setTimeout(()=>{
        timers.delete(timer);
        void load(currentSlrId());
      },120);
      timers.add(timer);
    };
    window.addEventListener('scopelogic:slr-changed',changed);
    window.addEventListener('scopelogic:slr-draft-saved',changed);
    return()=>{
      observer.disconnect();
      if(frame!==null)window.cancelAnimationFrame(frame);
      timers.forEach((timer)=>window.clearTimeout(timer));
      window.removeEventListener('scopelogic:slr-changed',changed);
      window.removeEventListener('scopelogic:slr-draft-saved',changed);
    };
  },[load]);

  useEffect(()=>{
    if(!slrId)return;
    setClOpen(true);
    setVeOpen(true);
    setNewDraft(null);
    void load(slrId);
  },[slrId,load]);

  const saveNew=async()=>{
    if(!newDraft||!projectId||!slrId||!newDraft.title.trim()||!newDraft.content.trim())return;
    try{
      const auth=await supabase.auth.getUser();const user=auth.data?.user;if(!user)throw new Error('Your ScopeLogic session expired.');
      const ownerId=clean(user.app_metadata?.scopelogic_workspace_owner_id||user.id);const actualId=clean(user.app_metadata?.scopelogic_actual_user_id||user.id);
      if(finding){
        const result=await supabase.from('master_project_deliverable_items').insert({owner_id:ownerId,master_project_id:masterId,created_by_user_id:actualId,related_master_finding_id:finding.id,deliverable_type:newDraft.type,sequence_number:0,display_number:'',system_name:newDraft.system_name,title:newDraft.title.trim(),content:newDraft.content.trim(),impact_considerations:newDraft.impact_considerations.trim(),reference:newDraft.reference.trim(),status:newDraft.status,response:newDraft.response.trim(),response_date:null,response_source:newDraft.response_source.trim(),client_facing:true,sort_order:0,source_child_uid:'',source_origin:'slr:manual'}).select('id,display_number').single();
        if(result.error)throw new Error(result.error.message);
        if(newDraft.type==='CL')clearClarificationSuppressionForMasterSlr(masterId,slrId);
        setMessage(`${result.data.display_number} saved to ${slrId}.`);
      }else{
        const sort=Math.max(0,...draftActions.map((item)=>Number(item.sort_order)||0))+1;
        const result=await supabase.from('slr_draft_deliverable_items').insert({owner_id:ownerId,created_by_user_id:actualId,project_id:projectId,slr_legacy_uid:`display:${slrId}`,draft_uid:crypto.randomUUID(),deliverable_type:newDraft.type,system_name:newDraft.system_name,title:newDraft.title.trim(),content:newDraft.content.trim(),impact_considerations:newDraft.impact_considerations.trim(),reference:newDraft.reference.trim(),status:newDraft.status,response:newDraft.response.trim(),response_source:newDraft.response_source.trim(),sort_order:sort}).select('id').single();
        if(result.error)throw new Error(result.error.message);
        setMessage(`${newDraft.type==='CL'?'GC Clarification':'VE Opportunity'} saved with this unsubmitted SLR.`);
      }
      if(newDraft.type==='CL')setClOpen(true);else setVeOpen(true);
      setNewDraft(null);await load(slrId);
    }catch(cause){setMessage(`${newDraft.type==='CL'?'GC Clarification':'VE Opportunity'} save failed: ${cause instanceof Error?cause.message:'Unknown cloud error.'}`);}
  };

  if(!host||!slrId)return null;
  const clItems=finding?actions.filter((item)=>item.deliverable_type==='CL'):draftActions.filter((item)=>item.deliverable_type==='CL');
  const veItems=finding?actions.filter((item)=>item.deliverable_type==='VE'):draftActions.filter((item)=>item.deliverable_type==='VE');
  const changed=()=>void load(slrId);
  const section=(type:Type,items:(Action|DraftAction)[],open:boolean,setOpen:(value:boolean)=>void)=><section className={`sl-approved-deliverable-section ${type==='CL'?'clarification':'ve'}`}><div className="sl-approved-deliverable-header"><div><b>{type==='CL'?'6. GC Clarifications':'7. VE Opportunities'}</b><span>{finding?'Linked to this submitted SLR':'Saved with this SLR draft and promoted automatically on Submit Entry'}</span></div><div><button type="button" className="primary" onClick={()=>setNewDraft(defaultForm(type))}>+ Add {type==='CL'?'GC Clarification':'VE Opportunity'}</button><button type="button" className="secondary" onClick={()=>setOpen(!open)} aria-expanded={open}>{open?'⌃':'⌄'}</button></div></div>{open&&<div className="sl-approved-deliverable-body">{items.length?items.map((item)=>finding?<ActionRow key={item.id} item={item as Action} masterId={masterId} slrId={slrId} onChanged={changed} onMessage={setMessage}/>:<DraftRow key={item.id} item={item as DraftAction} onChanged={changed} onMessage={setMessage}/>):<div className="sl-preview-state">No {type==='CL'?'GC Clarifications':'VE Opportunities'} added yet.</div>}</div>}</section>;
  return createPortal(<div className="sl-slr-deliverables-v2">{message&&<div className="sl-slr-message">{message}</div>}{newDraft&&<article className="sl-slr-deliverable-card new"><div className="sl-slr-deliverable-card-head"><div><b>NEW {newDraft.type}</b><span>{newDraft.type==='CL'?'GC Clarification':'VE Opportunity'}</span></div><button type="button" className="secondary" onClick={()=>setNewDraft(null)}>Cancel</button></div><div className="sl-slr-deliverable-grid"><label><span>System</span><input value={newDraft.system_name} onChange={(e)=>setNewDraft({...newDraft,system_name:e.target.value})}/></label><label><span>Title / Subject</span><input value={newDraft.title} onChange={(e)=>setNewDraft({...newDraft,title:e.target.value})}/></label><label className="wide"><span>{newDraft.type==='VE'?'VE Opportunity':'GC Clarification'}</span><textarea rows={3} value={newDraft.content} onChange={(e)=>setNewDraft({...newDraft,content:e.target.value})}/></label>{newDraft.type==='VE'?<label className="wide"><span>Potential Impact / Considerations</span><textarea rows={2} value={newDraft.impact_considerations} onChange={(e)=>setNewDraft({...newDraft,impact_considerations:e.target.value})}/></label>:<label className="wide"><span>Response / Resolution</span><textarea rows={2} value={newDraft.response} onChange={(e)=>setNewDraft({...newDraft,response:e.target.value})}/></label>}<label className="wide"><span>Document Reference</span><input value={newDraft.reference} onChange={(e)=>setNewDraft({...newDraft,reference:e.target.value})}/></label></div><div className="sl-slr-deliverable-actions"><button type="button" className="primary" disabled={!newDraft.title.trim()||!newDraft.content.trim()} onClick={()=>void saveNew()}>Save to SLR</button></div></article>}{section('CL',clItems,clOpen,setClOpen)}{section('VE',veItems,veOpen,setVeOpen)}</div>,host);
}
