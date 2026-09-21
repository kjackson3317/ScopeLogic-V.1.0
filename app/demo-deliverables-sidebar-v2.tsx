'use client';

import { useEffect } from 'react';

type Item={tab:string;label:string};
const ITEMS:Item[]=[
 {tab:'master-register',label:'Master Coordination Register'},
 {tab:'matrix',label:'Scope Matrix / RBB'},
 {tab:'clarifications',label:'GC Clarifications'},
 {tab:'rfi',label:'Formal RFI'},
 {tab:'ve',label:'VE Opportunities'},
 {tab:'checklist',label:'Contractor Scope Confirmation'},
 {tab:'bid-internal',label:'Bid Alignment'},
 {tab:'bid-report',label:'Reports / Official Releases'},
];

function heading(group:Element){
 return group.querySelector<HTMLElement>(':scope > .nav-folder-head, :scope > span, :scope > .nav-label');
}

function groupLabel(group:HTMLElement){
 const h=heading(group);
 return (h?.querySelector('b')?.textContent||h?.textContent||'').trim().toUpperCase();
}

function install(){
 const sidebar=document.querySelector<HTMLElement>('aside.sidebar');
 if(!sidebar)return false;
 const group=Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')).find((candidate)=>groupLabel(candidate)==='DELIVERABLES');
 if(!group)return false;

 group.classList.add('sl-nav-folder');
 const h=heading(group);
 if(h){
  h.classList.add('sl-nav-folder-heading');
  const count=h.querySelector<HTMLElement>('small');
  if(count)count.textContent=String(ITEMS.length);
 }

 const host=group.querySelector<HTMLElement>(':scope > .nav-folder-items');
 if(!host)return true;

 const current=Array.from(host.children) as HTMLElement[];
 const alreadyCorrect=current.length===ITEMS.length&&ITEMS.every((item,index)=>{
  const node=current[index];
  return node?.classList.contains('sl-deliverable-nav-link')&&node.dataset.deliverablePreview===item.tab&&node.textContent===item.label;
 });
 if(alreadyCorrect)return true;

 const fragment=document.createDocumentFragment();
 for(const item of ITEMS){
  const button=document.createElement('button');
  button.type='button';
  button.className='sl-deliverable-nav-link';
  button.dataset.deliverablePreview=item.tab;
  button.textContent=item.label;
  fragment.appendChild(button);
 }
 host.replaceChildren(fragment);
 group.dataset.inlineDeliverables='true';
 return true;
}

export default function DemoDeliverablesSidebarV2(){
 useEffect(()=>{
  let queued=false;
  const refresh=()=>{
   if(queued)return;
   queued=true;
   requestAnimationFrame(()=>{queued=false;install();});
  };
  refresh();
  const observer=new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true});
  const close=()=>document.querySelectorAll<HTMLElement>('.sl-deliverable-nav-link').forEach((node)=>node.classList.remove('active'));
  const sidebarClick=(event:Event)=>{
   const target=event.target as HTMLElement|null;
   if(!target||!target.closest('aside.sidebar')||target.closest('.sl-deliverable-nav-link'))return;
   if(document.body.classList.contains('sl-deliverable-preview-open'))window.dispatchEvent(new Event('scopelogic:close-deliverable-preview'));
  };
  window.addEventListener('scopelogic:close-deliverable-preview',close);
  document.addEventListener('click',sidebarClick,true);
  return()=>{
   observer.disconnect();
   window.removeEventListener('scopelogic:close-deliverable-preview',close);
   document.removeEventListener('click',sidebarClick,true);
  };
 },[]);
 return null;
}
