'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';
import { clearClarificationSuppressionForMasterSlr, suppressClarificationForMasterSlr } from '../lib/cloud-workspace';
import { resolveSlrProjectContext } from '../lib/slr-draft-cloud';

type Type = 'CL'|'VE';
type Finding = { id:string; display_number:string; scope_item:string; systems:string[]; status:string };
type Action = { id:string; related_master_finding_id:string|null; deliverable_type:Type; sequence_number:number; display_number:string; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string; sort_order:number };
type DraftAction = { id:string; project_id:string; slr_legacy_uid:string; draft_uid:string; deliverable_type:Type; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string; sort_order:number };
type FormDraft = { type:Type; system_name:string; title:string; content:string; impact_considerations:string; reference:string; status:string; response:string; response_source:string };

const clean=(value:unknown)=>String(value??'').trim();

function currentEditorContext(){
  const matrix=document.querySelector<HTMLElement>('.matrix-editor-full');
  return {
    legacyProjectId: clean(matrix?.dataset.projectId),
    masterProjectId: clean(matrix?.dataset.masterProjectId),
    slrId: clean(matrix?.dataset.slrId),
    slrUid: clean(matrix?.dataset.slrUid),
  };
}

function currentSlrId(){
  const explicit=currentEditorContext().slrId;
  if(explicit)return explicit;

  const labels=Array.from(
    document.querySelectorAll<HTMLLabelElement>(
      '.matrix-editor-full label.field'
    )
  );

  const target=labels.find(
    (label)=>clean(label.querySelector('span')?.textContent)==='SLR ID'
  );

  return clean(
    target?.querySelector<HTMLInputElement>('input')?.value
  );
}

function currentField(labelText:string){
  const labels=Array.from(document.querySelectorAll<HTMLLabelElement>('.matrix-editor-full label.field'));
  const target=labels.find((label)=>clean(label.querySelector('span')?.textContent)===labelText);
  return clean(target?.querySelector<HTMLInputElement|HTMLTextAreaElement>('input,textarea')?.value);
}

function currentSystem(){
  const checked=document.querySelector<HTMLInputElement>('.matrix-editor-full .system-selector-grid input[type="checkbox"]:checked');
  return clean(checked?.closest('label')?.textContent)||'Other';
}

function makeHost(){
  const matrix=document.querySelector<HTMLElement>('.matrix-editor-full');
  if(!matrix)return null;

  const details=matrix.querySelector<HTMLElement>('.detail-tabs');
  const bar=matrix.querySelector<HTMLElement>('.submit-bar');

  if(!details&&!bar)return null;

  let host=matrix.querySelector<HTMLElement>('.sl-slr-deliverables-v2-host');

  if(!host){
    host=document.createElement('div');
    host.className='sl-slr-deliverables-v2-host';
  }

  /*
   * Canonical SLR order:
   * child sections -> GC -> VE -> Details/Deliverables/History -> action bar
   */
  if(details?.parentElement){
    if(host.nextElementSibling!==details) details.before(host);
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
    const payload={
      system_name:draft.system_name,
      title:draft.title.trim(),
      content:draft.content.trim(),
      impact_considerations:draft.impact_considerations.trim(),
      reference:draft.reference.trim(),
      status:draft.status,
      response:draft.response.trim(),
      response_source:draft.response_source.trim(),
      updated_at:new Date().toISOString(),
      ...(item.deliverable_type==='CL'
        ? {source_child_uid:'',source_origin:'slr:manual'}
        : {}),
    };
    const result=await supabase
      .from('master_project_deliverable_items')
      .update(payload)
      .eq('id',item.id)
      .eq('master_project_id',masterId)
      .select('id,master_project_id,related_master_finding_id,system_name,title,content,impact_considerations,reference,status,response,response_source,source_child_uid,source_origin')
      .maybeSingle();
    setSaving(false);
    if(result.error||!result.data?.id){
      onMessage(`${item.display_number} save failed: ${result.error?.message||'Cloud verification failed.'}`);
      return;
    }
    const saved=result.data;
    const matches=
      clean(saved.system_name)===clean(payload.system_name) &&
      clean(saved.title)===clean(payload.title) &&
      clean(saved.content)===clean(payload.content) &&
      clean(saved.impact_considerations)===clean(payload.impact_considerations) &&
      clean(saved.reference)===clean(payload.reference) &&
      clean(saved.status)===clean(payload.status) &&
      clean(saved.response)===clean(payload.response) &&
      clean(saved.response_source)===clean(payload.response_source) &&
      clean(saved.related_master_finding_id)===clean(item.related_master_finding_id);
    if(!matches){
      onMessage(`${item.display_number} save failed cloud verification. Your screen values were not confirmed.`);
      return;
    }
    if(item.deliverable_type==='CL' && (clean(saved.source_child_uid)!=='' || clean(saved.source_origin)!=='slr:manual')){
      onMessage(`${item.display_number} save failed persistence verification.`);
      return;
    }
    onMessage(`${item.display_number} saved and verified in the cloud.`);
    onChanged();
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

export default function SlrDeliverablesEditor(){
  const supabase=useMemo(()=>createClient() as any,[]);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [slrId,setSlrId]=useState('');
  const [slrUid,setSlrUid]=useState('');
  const [projectId,setProjectId]=useState('');
  const [masterId,setMasterId]=useState('');
  const [finding,setFinding]=useState<Finding|null>(null);
  const [actions,setActions]=useState<Action[]>([]);
  const [draftActions,setDraftActions]=useState<DraftAction[]>([]);
  const [message,setMessage]=useState('');
  const [newDraft,setNewDraft]=useState<FormDraft|null>(null);
  const [clOpen,setClOpen]=useState(true);
  const [veOpen,setVeOpen]=useState(true);
  const loadRequestRef=useRef(0);

  const load=useCallback(async(nextSlr?:string,nextSlrUid?:string)=>{
    const requestId=++loadRequestRef.current;
    const target=clean(nextSlr||currentSlrId());
    const targetUid=clean(nextSlrUid||currentEditorContext().slrUid);

    if(!target){
      if(requestId===loadRequestRef.current){
        setSlrId('');
        setSlrUid('');
        setFinding(null);
        setActions([]);
        setDraftActions([]);
      }
      return;
    }

    try{
      const editorContext=currentEditorContext();

      if(!editorContext.legacyProjectId){
        throw new Error(
          'The active project is not available in the SLR workspace.'
        );
      }

      const context=await resolveSlrProjectContext(
        editorContext.legacyProjectId
      );

      if(
        editorContext.masterProjectId &&
        context.masterProjectId!==editorContext.masterProjectId
      ){
        throw new Error(
          'Project context changed while loading GC/VE.'
        );
      }

      let findingQuery=supabase
        .from('master_project_findings')
        .select('id,display_number,scope_item,systems,status')
        .eq('master_project_id',context.masterProjectId);

      findingQuery=targetUid
        ? findingQuery.eq('legacy_uid',targetUid)
        : findingQuery.eq('display_number',target);

      const findingResult=await findingQuery.maybeSingle();

      if(findingResult.error){
        throw new Error(findingResult.error.message);
      }

      const nextFinding=(findingResult.data||null) as Finding|null;
      let nextActions:Action[]=[];
      let nextDraftActions:DraftAction[]=[];

      if(nextFinding){
        const actionResult=await supabase
          .from('master_project_deliverable_items')
          .select('*')
          .eq('master_project_id',context.masterProjectId)
          .eq('related_master_finding_id',nextFinding.id)
          .in('deliverable_type',['CL','VE'])
          .order('deliverable_type')
          .order('sequence_number');

        if(actionResult.error){
          throw new Error(actionResult.error.message);
        }

        nextActions=(actionResult.data||[]) as Action[];
      }else{
        const draftResult=await supabase
          .from('slr_draft_deliverable_items')
          .select('*')
          .eq('project_id',context.projectId)
          .in(
            'slr_legacy_uid',
            targetUid ? [targetUid,`display:${target}`] : [`display:${target}`]
          )
          .order('sort_order')
          .order('created_at');

        if(draftResult.error){
          throw new Error(draftResult.error.message);
        }

        nextDraftActions=(draftResult.data||[]) as DraftAction[];
      }

      // Ignore any request belonging to an SLR that is no longer selected.
      if(requestId!==loadRequestRef.current)return;

      setProjectId(context.projectId);
      setMasterId(context.masterProjectId);
      setSlrId(target);
      setSlrUid(targetUid);
      setFinding(nextFinding);
      setActions(nextActions);
      setDraftActions(nextDraftActions);
      setMessage('');
    }catch(cause){
      if(requestId!==loadRequestRef.current)return;

      // Never leave the previous SLR visible after a failed/new load.
      setFinding(null);
      setActions([]);
      setDraftActions([]);

      setMessage(
        `GC/VE load failed: ${
          cause instanceof Error
            ? cause.message
            : 'Unknown cloud error.'
        }`
      );
    }
  },[supabase]);

  useEffect(()=>{
    let bodyObserver:MutationObserver|null=null;
    let matrixObserver:MutationObserver|null=null;
    let observedMatrix:HTMLElement|null=null;
    let activeIdentity='';

    const switchSlr=(id:string,uid='')=>{
      const next=clean(id);
      const nextUid=clean(uid);
      const identity=`${nextUid}::${next}`;

      if(identity===activeIdentity)return;
      activeIdentity=identity;

      // Invalidate the previous SLR request immediately.
      loadRequestRef.current+=1;

      // Clear all prior-SLR UI immediately.
      setNewDraft(null);
      setFinding(null);
      setActions([]);
      setDraftActions([]);
      setMessage('');
      setClOpen(true);
      setVeOpen(true);
      setSlrId(next);
      setSlrUid(nextUid);

      if(next)void load(next,nextUid);
    };

    const readContext=()=>{
      const context=currentEditorContext();
      switchSlr(context.slrId||currentSlrId(),context.slrUid);
    };

    const bindMatrix=()=>{
      const matrix=document.querySelector<HTMLElement>(
        '.matrix-editor-full'
      );

      if(matrix===observedMatrix){
        setHost(makeHost());
        return;
      }

      matrixObserver?.disconnect();
      matrixObserver=null;
      observedMatrix=matrix;

      setHost(makeHost());

      if(!matrix){
        switchSlr('');
        return;
      }

      matrixObserver=new MutationObserver(()=>{
        readContext();
      });

      // Watch only the React-owned identity attributes.
      matrixObserver.observe(matrix,{
        attributes:true,
        attributeFilter:[
          'data-slr-id',
          'data-slr-uid',
          'data-project-id',
          'data-master-project-id'
        ]
      });

      readContext();
    };

    // Body observer is now structural only.
    // It does NOT trigger Supabase loads for arbitrary attribute changes.
    bodyObserver=new MutationObserver(()=>{
      bindMatrix();
    });

    bodyObserver.observe(document.body,{
      childList:true,
      subtree:true
    });

    bindMatrix();

    const reloadCurrent=()=>{
      const context=currentEditorContext();
      const id=clean(context.slrId||currentSlrId());
      if(id)void load(id,context.slrUid);
    };

    window.addEventListener(
      'scopelogic:slr-changed',
      reloadCurrent
    );

    window.addEventListener(
      'scopelogic:slr-draft-saved',
      reloadCurrent
    );

    return()=>{
      bodyObserver?.disconnect();
      matrixObserver?.disconnect();

      window.removeEventListener(
        'scopelogic:slr-changed',
        reloadCurrent
      );

      window.removeEventListener(
        'scopelogic:slr-draft-saved',
        reloadCurrent
      );
    };
  },[load]);

  const saveNew=async()=>{
    if(!newDraft||!projectId||!slrId||!newDraft.title.trim()||!newDraft.content.trim())return;
    try{
      const auth=await supabase.auth.getUser();const user=auth.data?.user;if(!user)throw new Error('Your ScopeLogic session expired.');
      const ownerId=clean(user.app_metadata?.scopelogic_workspace_owner_id||user.id);const actualId=clean(user.app_metadata?.scopelogic_actual_user_id||user.id);
      if(finding){
        const result=await supabase.from('master_project_deliverable_items').insert({owner_id:ownerId,master_project_id:masterId,created_by_user_id:actualId,related_master_finding_id:finding.id,deliverable_type:newDraft.type,sequence_number:0,display_number:'',system_name:newDraft.system_name,title:newDraft.title.trim(),content:newDraft.content.trim(),impact_considerations:newDraft.impact_considerations.trim(),reference:newDraft.reference.trim(),status:newDraft.status,response:newDraft.response.trim(),response_date:null,response_source:newDraft.response_source.trim(),client_facing:true,sort_order:0,source_child_uid:'',source_origin:'slr:manual'}).select('id,display_number').single();
        if(result.error)throw new Error(result.error.message);
        if(newDraft.type==='CL')clearClarificationSuppressionForMasterSlr(masterId,slrUid||slrId);
        setMessage(`${result.data.display_number} saved to ${slrId}.`);
      }else{
        const sort=Math.max(0,...draftActions.map((item)=>Number(item.sort_order)||0))+1;
        const result=await supabase.from('slr_draft_deliverable_items').insert({owner_id:ownerId,created_by_user_id:actualId,project_id:projectId,slr_legacy_uid:slrUid||`display:${slrId}`,draft_uid:crypto.randomUUID(),deliverable_type:newDraft.type,system_name:newDraft.system_name,title:newDraft.title.trim(),content:newDraft.content.trim(),impact_considerations:newDraft.impact_considerations.trim(),reference:newDraft.reference.trim(),status:newDraft.status,response:newDraft.response.trim(),response_source:newDraft.response_source.trim(),sort_order:sort}).select('id').single();
        if(result.error)throw new Error(result.error.message);
        setMessage(`${newDraft.type==='CL'?'GC Clarification':'VE Opportunity'} saved with this unsubmitted SLR.`);
      }
      if(newDraft.type==='CL')setClOpen(true);else setVeOpen(true);
      setNewDraft(null);await load(slrId,slrUid);
    }catch(cause){setMessage(`${newDraft.type==='CL'?'GC Clarification':'VE Opportunity'} save failed: ${cause instanceof Error?cause.message:'Unknown cloud error.'}`);}
  };

  if(!host||!slrId)return null;

  const clItems=finding
    ? actions.filter((item)=>item.deliverable_type==='CL')
    : draftActions.filter((item)=>item.deliverable_type==='CL');

  const veItems=finding
    ? actions.filter((item)=>item.deliverable_type==='VE')
    : draftActions.filter((item)=>item.deliverable_type==='VE');

  const changed=()=>void load(slrId,slrUid);

  const renderNewForm=(type:Type)=>{
    if(!newDraft || newDraft.type!==type) return null;

    const isVe=type==='VE';

    return (
      <article className="sl-slr-deliverable-card new">
        <div className="sl-slr-deliverable-card-head">
          <div>
            <b>NEW {type}</b>
            <span>{isVe?'VE Opportunity':'GC Clarification'}</span>
          </div>

          <button
            type="button"
            className="secondary"
            onClick={()=>setNewDraft(null)}
          >
            Cancel
          </button>
        </div>

        <div className="sl-slr-deliverable-grid">
          <label>
            <span>System</span>
            <input
              value={newDraft.system_name}
              onChange={(e)=>setNewDraft({
                ...newDraft,
                system_name:e.target.value
              })}
            />
          </label>

          <label>
            <span>Title / Subject</span>
            <input
              value={newDraft.title}
              onChange={(e)=>setNewDraft({
                ...newDraft,
                title:e.target.value
              })}
            />
          </label>

          <label className="wide">
            <span>{isVe?'VE Opportunity':'GC Clarification'}</span>
            <textarea
              rows={3}
              value={newDraft.content}
              onChange={(e)=>setNewDraft({
                ...newDraft,
                content:e.target.value
              })}
            />
          </label>

          {isVe ? (
            <label className="wide">
              <span>Potential Impact / Considerations</span>
              <textarea
                rows={2}
                value={newDraft.impact_considerations}
                onChange={(e)=>setNewDraft({
                  ...newDraft,
                  impact_considerations:e.target.value
                })}
              />
            </label>
          ) : (
            <label className="wide">
              <span>Response / Resolution</span>
              <textarea
                rows={2}
                value={newDraft.response}
                onChange={(e)=>setNewDraft({
                  ...newDraft,
                  response:e.target.value
                })}
              />
            </label>
          )}

          <label className="wide">
            <span>Document Reference</span>
            <input
              value={newDraft.reference}
              onChange={(e)=>setNewDraft({
                ...newDraft,
                reference:e.target.value
              })}
            />
          </label>
        </div>

        <div className="sl-slr-deliverable-actions">
          <button
            type="button"
            className="primary"
            disabled={
              !newDraft.title.trim() ||
              !newDraft.content.trim()
            }
            onClick={()=>void saveNew()}
          >
            Save to SLR
          </button>
        </div>
      </article>
    );
  };

  const section=(
    type:Type,
    items:(Action|DraftAction)[],
    open:boolean,
    setOpen:(value:boolean)=>void,
  )=>{
    const isCl=type==='CL';

    return (
      <section
        className={`sl-approved-deliverable-section ${
          isCl ? 'clarification' : 've'
        }`}
      >
        <div className="sl-approved-deliverable-header">
          <div>
            <b>{isCl?'7. GC Clarifications':'8. VE Opportunities'}</b>
            <span>
              {finding
                ? 'Linked to this submitted SLR'
                : 'Saved with this SLR draft and promoted automatically on Submit Entry'}
            </span>
          </div>

          <div>
            <button
              type="button"
              className="primary"
              onClick={()=>{
                setOpen(true);
                setNewDraft(defaultForm(type));
              }}
            >
              + Add {isCl?'GC Clarification':'VE Opportunity'}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={()=>setOpen(!open)}
              aria-expanded={open}
            >
              {open?'Collapse':'Expand'}
            </button>
          </div>
        </div>

        {open && (
          <div className="sl-approved-deliverable-body">
            {items.length ? (
              items.map((item)=>
                finding ? (
                  <ActionRow
                    key={item.id}
                    item={item as Action}
                    masterId={masterId}
                    slrId={slrUid||slrId}
                    onChanged={changed}
                    onMessage={setMessage}
                  />
                ) : (
                  <DraftRow
                    key={item.id}
                    item={item as DraftAction}
                    onChanged={changed}
                    onMessage={setMessage}
                  />
                )
              )
            ) : (
              <div className="sl-preview-state">
                No {isCl?'GC Clarifications':'VE Opportunities'} added yet.
              </div>
            )}

            {/* New item belongs inside its own section, after existing rows. */}
            {renderNewForm(type)}
          </div>
        )}
      </section>
    );
  };

  return createPortal(
    <div className="sl-slr-deliverables-v2">
      {message && (
        <div className="sl-slr-message">
          {message}
        </div>
      )}

      {section('CL',clItems,clOpen,setClOpen)}
      {section('VE',veItems,veOpen,setVeOpen)}
    </div>,
    host,
  );
}
