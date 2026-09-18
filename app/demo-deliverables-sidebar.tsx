'use client';

import { useEffect } from 'react';

type Item = { tab:string; label:string };
const ITEMS:Item[]=[
  {tab:'matrix',label:'Scope Matrix / RBB'},
  {tab:'clarifications',label:'GC Clarifications'},
  {tab:'rfi',label:'Formal RFI'},
  {tab:'ve',label:'VE Opportunities'},
  {tab:'checklist',label:'Contractor Scope Confirmation'},
  {tab:'bid-internal',label:'Bid Alignment'},
  {tab:'bid-report',label:'Reports / Official Releases'},
];

function heading(group:Element){return group.querySelector<HTMLElement>(':scope > span, :scope > .nav-label');}
function setFolderOpen(group:HTMLElement,open:boolean){group.classList.toggle('open',open);heading(group)?.setAttribute('aria-expanded',String(open));}
function prepareFolder(group:HTMLElement){const h=heading(group);if(!h)return;group.classList.add('sl-nav-folder');h.classList.add('sl-nav-folder-heading');if(group.dataset.demoFolderReady==='true')return;group.dataset.demoFolderReady='true';h.setAttribute('role','button');h.setAttribute('tabindex','0');const toggle=()=>setFolderOpen(group,!group.classList.contains('open'));h.addEventListener('click',toggle);h.addEventListener('keydown',(event)=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();toggle();});setFolderOpen(group,false);}
function install(){
  const sidebar=document.querySelector<HTMLElement>('aside.sidebar');if(!sidebar)return false;
  const group=Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')).find((candidate)=>heading(candidate)?.textContent?.trim().toUpperCase()==='DELIVERABLES');if(!group)return false;
  prepareFolder(group);
  if(group.dataset.inlineDeliverables==='true'&&group.querySelector(':scope > .sl-deliverable-nav-link'))return true;
  const h=heading(group);Array.from(group.children).forEach((child)=>{if(child!==h)child.remove();});
  for(const item of ITEMS){const button=document.createElement('button');button.type='button';button.textContent=item.label;button.className='sl-deliverable-nav-link';button.dataset.deliverablePreview=item.tab;button.addEventListener('click',()=>{group.querySelectorAll<HTMLElement>(':scope > .sl-deliverable-nav-link').forEach((node)=>node.classList.toggle('active',node===button));setFolderOpen(group,true);window.dispatchEvent(new CustomEvent('scopelogic:deliverable-preview',{detail:{tab:item.tab,label:item.label}}));});group.appendChild(button);}
  group.dataset.inlineDeliverables='true';return true;
}

export default function DemoDeliverablesSidebar(){useEffect(()=>{let queued=false;const refresh=()=>{if(queued)return;queued=true;window.requestAnimationFrame(()=>{queued=false;install();});};refresh();const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true});const close=()=>document.querySelectorAll<HTMLElement>('.sl-deliverable-nav-link').forEach((node)=>node.classList.remove('active'));window.addEventListener('scopelogic:close-deliverable-preview',close);return()=>{observer.disconnect();window.removeEventListener('scopelogic:close-deliverable-preview',close);};},[]);return null;}
