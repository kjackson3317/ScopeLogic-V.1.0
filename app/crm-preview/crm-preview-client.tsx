'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import styles from './crm-preview.module.css';

type View = 'dashboard' | 'clients' | 'communications' | 'projects' | 'followups';
type RelationshipStatus = 'Prospect' | 'Active Client' | 'Past Client' | 'Dormant';
type ProjectStatus = 'Upcoming' | 'Active' | 'Complete' | 'On Hold' | 'Cancelled';
type CommunicationType = 'Email' | 'Call' | 'Teams' | 'Meeting' | 'Text' | 'Document' | 'Note';
type Direction = 'Outgoing' | 'Incoming' | 'Internal';
type ModalKind = null | 'client' | 'contact' | 'communication' | 'followup' | 'project' | 'invoice' | 'payment' | 'reset';

type Company = { id:string; name:string; type:'GC'|'CM'|'Owner'|'Other'; status:RelationshipStatus; website:string; city:string; state:string; notes:string };
type Contact = { id:string; companyId:string; name:string; title:string; email:string; phone:string };
type Project = { id:string; companyId:string; name:string; service:string; status:ProjectStatus; contractValue:number; startDate:string; targetDate:string; completedDate:string; notes:string };
type Invoice = { id:string; projectId:string; invoiceNumber:string; amount:number; issuedDate:string; dueDate:string; notes:string };
type Payment = { id:string; invoiceId:string; amount:number; paymentDate:string; reference:string };
type Communication = { id:string; companyId:string; contactId?:string; projectId?:string; type:CommunicationType; direction:Direction; date:string; subject:string; summary:string };
type FollowUp = { id:string; companyId:string; contactId?:string; projectId?:string; title:string; dueDate:string; completed:boolean };
type CrmData = { companies:Company[]; contacts:Contact[]; projects:Project[]; invoices:Invoice[]; payments:Payment[]; communications:Communication[]; followUps:FollowUp[] };

type Draft = {
  companyId:string; contactId:string; projectId:string; invoiceId:string;
  name:string; title:string; email:string; phone:string; website:string; city:string; state:string; notes:string;
  relationshipStatus:RelationshipStatus; companyType:Company['type']; service:string; projectStatus:ProjectStatus; contractValue:string; startDate:string; targetDate:string;
  communicationType:CommunicationType; direction:Direction; date:string; subject:string; summary:string; createFollowUp:boolean; followUpTitle:string; followUpDate:string;
  invoiceNumber:string; amount:string; issuedDate:string; dueDate:string; reference:string;
};

const storageKey = 'scopelogic-crm-preview-v3';
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0,10);
const addDays = (days:number) => { const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
const yearShift = (years:number) => { const d = new Date(); d.setFullYear(d.getFullYear()+years); return d.toISOString().slice(0,10); };
const money = (value:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value||0);
const blankDraft = ():Draft => ({ companyId:'',contactId:'',projectId:'',invoiceId:'',name:'',title:'',email:'',phone:'',website:'',city:'',state:'',notes:'',relationshipStatus:'Prospect',companyType:'GC',service:'P1 + P2 Quick Review',projectStatus:'Active',contractValue:'450',startDate:today(),targetDate:addDays(7),communicationType:'Email',direction:'Outgoing',date:today(),subject:'',summary:'',createFollowUp:false,followUpTitle:'',followUpDate:addDays(7),invoiceNumber:'',amount:'',issuedDate:today(),dueDate:addDays(30),reference:'ACH' });

function seedData():CrmData { return {
  companies:[
    {id:'c1',name:'Demo Prospective GC',type:'GC',status:'Prospect',website:'https://example.com',city:'Atlanta',state:'GA',notes:'Potential client. Introductory ScopeLogic information has been sent.'},
    {id:'c2',name:'Demo Active GC',type:'GC',status:'Active Client',website:'',city:'Charlotte',state:'NC',notes:'Existing client with both Quick Review and larger-project history.'},
    {id:'c3',name:'Demo Past Client',type:'CM',status:'Past Client',website:'',city:'Nashville',state:'TN',notes:'Completed prior engagement. Keep relationship warm.'}
  ],
  contacts:[
    {id:'ct1',companyId:'c1',name:'Alex Morgan',title:'Preconstruction Manager',email:'alex@example.com',phone:''},
    {id:'ct2',companyId:'c2',name:'Jordan Lee',title:'Senior Estimator',email:'jordan@example.com',phone:''},
    {id:'ct3',companyId:'c2',name:'Casey Brown',title:'Project Executive',email:'casey@example.com',phone:''},
    {id:'ct4',companyId:'c3',name:'Taylor Smith',title:'Director of Preconstruction',email:'taylor@example.com',phone:''}
  ],
  projects:[
    {id:'p1',companyId:'c2',name:'Retail TI Quick Review',service:'P1 + P2 Quick Review',status:'Active',contractValue:450,startDate:addDays(-4),targetDate:addDays(2),completedDate:'',notes:'Current small-project pilot.'},
    {id:'p2',companyId:'c2',name:'Corporate Campus Technology Review',service:'Product 1 — Technology Scope & Risk Assessment',status:'Complete',contractValue:3500,startDate:addDays(-90),targetDate:addDays(-65),completedDate:addDays(-62),notes:'Completed and paid.'},
    {id:'p3',companyId:'c3',name:'School Renovation Bid Validation',service:'Product 2 — Bid Analysis & Budget Validation',status:'Complete',contractValue:2750,startDate:yearShift(-1),targetDate:yearShift(-1),completedDate:yearShift(-1),notes:'Prior-year completed engagement.'}
  ],
  invoices:[
    {id:'i1',projectId:'p1',invoiceNumber:'SL-1001',amount:450,issuedDate:addDays(-3),dueDate:addDays(27),notes:'Net 30.'},
    {id:'i2',projectId:'p2',invoiceNumber:'SL-0987',amount:3500,issuedDate:addDays(-70),dueDate:addDays(-40),notes:''},
    {id:'i3',projectId:'p3',invoiceNumber:'SL-0812',amount:2750,issuedDate:yearShift(-1),dueDate:yearShift(-1),notes:''}
  ],
  payments:[{id:'pay1',invoiceId:'i2',amount:3500,paymentDate:addDays(-38),reference:'ACH'},{id:'pay2',invoiceId:'i3',amount:2750,paymentDate:yearShift(-1),reference:'ACH'}],
  communications:[
    {id:'com1',companyId:'c1',contactId:'ct1',type:'Email',direction:'Outgoing',date:today(),subject:'ScopeLogic Introduction',summary:'Sent introductory email with both one-page ScopeLogic service overviews.'},
    {id:'com2',companyId:'c2',contactId:'ct2',projectId:'p1',type:'Email',direction:'Incoming',date:addDays(-4),subject:'Retail TI project',summary:'Client sent drawings and asked ScopeLogic to try the project.'},
    {id:'com3',companyId:'c2',contactId:'ct2',projectId:'p1',type:'Email',direction:'Outgoing',date:addDays(-3),subject:'Project authorization',summary:'Confirmed Quick Review scope, fee, turnaround, and sent project authorization.'},
    {id:'com4',companyId:'c2',contactId:'ct3',projectId:'p2',type:'Teams',direction:'Outgoing',date:addDays(-62),subject:'Final review meeting',summary:'Reviewed final Technology Scope & Risk Assessment findings with project team.'},
    {id:'com5',companyId:'c3',contactId:'ct4',projectId:'p3',type:'Email',direction:'Outgoing',date:yearShift(-1),subject:'Final bid validation',summary:'Delivered final bid comparison and recommendation.'}
  ],
  followUps:[
    {id:'f1',companyId:'c1',contactId:'ct1',title:'Follow up on ScopeLogic introduction',dueDate:addDays(7),completed:false},
    {id:'f2',companyId:'c2',contactId:'ct2',projectId:'p1',title:'Confirm Quick Review delivery and invoice status',dueDate:addDays(2),completed:false},
    {id:'f3',companyId:'c3',contactId:'ct4',title:'Relationship check-in with past client',dueDate:today(),completed:false}
  ]
}; }

export default function CrmPreviewClient({userEmail}:{userEmail:string}) {
  const [view,setView] = useState<View>('dashboard');
  const [data,setData] = useState<CrmData>(()=>seedData());
  const [hydrated,setHydrated] = useState(false);
  const [search,setSearch] = useState('');
  const [selectedCompanyId,setSelectedCompanyId] = useState('c1');
  const [selectedProjectId,setSelectedProjectId] = useState('p1');
  const [modal,setModal] = useState<ModalKind>(null);
  const [draft,setDraft] = useState<Draft>(()=>blankDraft());
  const [notice,setNotice] = useState('');

  useEffect(()=>{ try { const saved=localStorage.getItem(storageKey); if(saved) setData(JSON.parse(saved)); } catch {} setHydrated(true); },[]);
  useEffect(()=>{ if(hydrated) localStorage.setItem(storageKey,JSON.stringify(data)); },[data,hydrated]);

  const companyMap = useMemo(()=>new Map(data.companies.map(x=>[x.id,x])),[data.companies]);
  const contactMap = useMemo(()=>new Map(data.contacts.map(x=>[x.id,x])),[data.contacts]);
  const projectMap = useMemo(()=>new Map(data.projects.map(x=>[x.id,x])),[data.projects]);
  const invoiceMap = useMemo(()=>new Map(data.invoices.map(x=>[x.id,x])),[data.invoices]);
  const invoicePaid=(id:string)=>data.payments.filter(x=>x.invoiceId===id).reduce((s,x)=>s+x.amount,0);
  const invoiceBalance=(i:Invoice)=>Math.max(0,i.amount-invoicePaid(i.id));
  const projectInvoices=(id:string)=>data.invoices.filter(x=>x.projectId===id);
  const projectInvoiced=(id:string)=>projectInvoices(id).reduce((s,x)=>s+x.amount,0);
  const projectPaid=(id:string)=>projectInvoices(id).reduce((s,x)=>s+invoicePaid(x.id),0);
  const projectBalance=(id:string)=>projectInvoices(id).reduce((s,x)=>s+invoiceBalance(x),0);

  const selectedCompany=data.companies.find(x=>x.id===selectedCompanyId)||data.companies[0];
  const selectedProject=data.projects.find(x=>x.id===selectedProjectId)||data.projects[0];
  const selectedContacts=data.contacts.filter(x=>x.companyId===selectedCompany?.id);
  const selectedProjects=data.projects.filter(x=>x.companyId===selectedCompany?.id);
  const selectedComms=data.communications.filter(x=>x.companyId===selectedCompany?.id).sort((a,b)=>b.date.localeCompare(a.date));
  const selectedFollowUps=data.followUps.filter(x=>x.companyId===selectedCompany?.id&&!x.completed).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const openFollowUps=data.followUps.filter(x=>!x.completed).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const dueFollowUps=openFollowUps.filter(x=>x.dueDate<=today());
  const activeProjects=data.projects.filter(x=>x.status==='Active'||x.status==='Upcoming');
  const outstandingInvoices=data.invoices.filter(x=>invoiceBalance(x)>0).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const outstandingAR=outstandingInvoices.reduce((s,x)=>s+invoiceBalance(x),0);
  const currentYear=new Date().getFullYear();
  const paymentsYtd=data.payments.filter(x=>new Date(x.paymentDate).getFullYear()===currentYear).reduce((s,x)=>s+x.amount,0);
  const paymentsAllTime=data.payments.reduce((s,x)=>s+x.amount,0);
  const filteredCompanies=data.companies.filter(company=>{const q=search.trim().toLowerCase(); if(!q)return true; const contacts=data.contacts.filter(c=>c.companyId===company.id); return [company.name,company.status,company.city,company.state,company.notes,...contacts.flatMap(c=>[c.name,c.title,c.email])].join(' ').toLowerCase().includes(q);});

  const flash=(m:string)=>{setNotice(m);window.setTimeout(()=>setNotice(''),2200);};
  const openModal=(kind:Exclude<ModalKind,null>, seed?:Partial<Draft>)=>{ setDraft({...blankDraft(),...seed}); setModal(kind); };
  const closeModal=()=>setModal(null);
  const update=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(d=>({...d,[key]:value}));

  const openClient=()=>openModal('client');
  const openContact=(companyId=selectedCompany?.id)=>openModal('contact',{companyId:companyId||''});
  const openCommunication=(companyId=selectedCompany?.id,projectId?:string)=>{
    const cid=companyId||data.companies[0]?.id||'';
    const contact=data.contacts.find(c=>c.companyId===cid);
    openModal('communication',{companyId:cid,contactId:contact?.id||'',projectId:projectId||''});
  };
  const openFollowUp=(companyId=selectedCompany?.id,projectId?:string)=>{
    const cid=companyId||data.companies[0]?.id||'';
    const contact=data.contacts.find(c=>c.companyId===cid);
    openModal('followup',{companyId:cid,contactId:contact?.id||'',projectId:projectId||''});
  };
  const openProject=(companyId=selectedCompany?.id)=>openModal('project',{companyId:companyId||data.companies[0]?.id||''});
  const openInvoice=(projectId=selectedProject?.id)=>{ const p=projectId?projectMap.get(projectId):undefined; openModal('invoice',{projectId:projectId||'',amount:String(p?.contractValue||0),invoiceNumber:`SL-${data.invoices.length+1001}`}); };
  const openPayment=(invoiceId?:string)=>{ const target=invoiceId||(selectedProject?projectInvoices(selectedProject.id).find(i=>invoiceBalance(i)>0)?.id:''); const inv=target?invoiceMap.get(target):undefined; if(!target||!inv){flash('No unpaid invoice is available for this project.');return;} openModal('payment',{invoiceId:target,amount:String(invoiceBalance(inv))}); };

  const submitModal=(e:FormEvent)=>{
    e.preventDefault();
    if(modal==='client'){
      if(!draft.name.trim()) return;
      const item:Company={id:uid(),name:draft.name.trim(),type:draft.companyType,status:draft.relationshipStatus,website:draft.website.trim(),city:draft.city.trim(),state:draft.state.trim(),notes:draft.notes.trim()};
      setData(d=>({...d,companies:[...d.companies,item]})); setSelectedCompanyId(item.id); setView('clients'); flash('Client added.');
    }
    if(modal==='contact'){
      if(!draft.companyId||!draft.name.trim()) return;
      const item:Contact={id:uid(),companyId:draft.companyId,name:draft.name.trim(),title:draft.title.trim(),email:draft.email.trim(),phone:draft.phone.trim()};
      setData(d=>({...d,contacts:[...d.contacts,item]})); flash('Contact added.');
    }
    if(modal==='communication'){
      if(!draft.companyId||!draft.summary.trim()) return;
      const item:Communication={id:uid(),companyId:draft.companyId,contactId:draft.contactId||undefined,projectId:draft.projectId||undefined,type:draft.communicationType,direction:draft.direction,date:draft.date,subject:draft.subject.trim(),summary:draft.summary.trim()};
      setData(d=>({...d,communications:[item,...d.communications],followUps:draft.createFollowUp&&draft.followUpTitle.trim()?[...d.followUps,{id:uid(),companyId:draft.companyId,contactId:draft.contactId||undefined,projectId:draft.projectId||undefined,title:draft.followUpTitle.trim(),dueDate:draft.followUpDate,completed:false}]:d.followUps}));
      flash(draft.createFollowUp?'Communication and follow-up saved.':'Communication saved.');
    }
    if(modal==='followup'){
      if(!draft.companyId||!draft.followUpTitle.trim()) return;
      const item:FollowUp={id:uid(),companyId:draft.companyId,contactId:draft.contactId||undefined,projectId:draft.projectId||undefined,title:draft.followUpTitle.trim(),dueDate:draft.followUpDate,completed:false};
      setData(d=>({...d,followUps:[...d.followUps,item]})); flash('Follow-up added.');
    }
    if(modal==='project'){
      if(!draft.companyId||!draft.name.trim()) return;
      const value=Number(draft.contractValue)||0;
      const item:Project={id:uid(),companyId:draft.companyId,name:draft.name.trim(),service:draft.service.trim(),status:draft.projectStatus,contractValue:value,startDate:draft.startDate,targetDate:draft.targetDate,completedDate:'',notes:draft.notes.trim()};
      setData(d=>({...d,projects:[...d.projects,item],companies:d.companies.map(c=>c.id===draft.companyId?{...c,status:'Active Client'}:c)})); setSelectedProjectId(item.id); setView('projects'); flash('Project added.');
    }
    if(modal==='invoice'){
      if(!draft.projectId||!draft.invoiceNumber.trim()) return;
      const item:Invoice={id:uid(),projectId:draft.projectId,invoiceNumber:draft.invoiceNumber.trim(),amount:Number(draft.amount)||0,issuedDate:draft.issuedDate,dueDate:draft.dueDate,notes:draft.notes.trim()};
      setData(d=>({...d,invoices:[...d.invoices,item]})); flash('Invoice recorded.');
    }
    if(modal==='payment'){
      if(!draft.invoiceId||!(Number(draft.amount)>0)) return;
      const item:Payment={id:uid(),invoiceId:draft.invoiceId,amount:Number(draft.amount),paymentDate:draft.date,reference:draft.reference.trim()};
      setData(d=>({...d,payments:[...d.payments,item]})); flash('Payment recorded.');
    }
    closeModal();
  };

  const completeFollowUp=(id:string)=>setData(d=>({...d,followUps:d.followUps.map(x=>x.id===id?{...x,completed:!x.completed}:x)}));
  const resetDemo=()=>{ const next=seedData(); setData(next); setSelectedCompanyId(next.companies[0]?.id||''); setSelectedProjectId(next.projects[0]?.id||''); setModal(null); flash('Demo data reset.'); };
  const exportJson=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ScopeLogic-CRM-Preview-${today()}.json`;a.click();URL.revokeObjectURL(url);};

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <a href="/" className={styles.brand}><img src="/brand/scopelogic-logo-full.png" alt="ScopeLogic" /></a>
      <div className={styles.previewTag}>CLIENT CRM · PREVIEW ONLY</div>
      <nav className={styles.nav}>
        <button className={view==='dashboard'?styles.active:''} onClick={()=>setView('dashboard')}>Relationship Dashboard</button>
        <button className={view==='clients'?styles.active:''} onClick={()=>setView('clients')}>Clients & Contacts</button>
        <button className={view==='communications'?styles.active:''} onClick={()=>setView('communications')}>Communications</button>
        <button className={view==='projects'?styles.active:''} onClick={()=>setView('projects')}>Projects & Billing</button>
        <button className={view==='followups'?styles.active:''} onClick={()=>setView('followups')}>Follow-Ups</button>
      </nav>
      <div className={styles.sidebarFoot}><span>Signed in</span><b>{userEmail}</b><a href="/">← Back to ScopeLogic</a></div>
    </aside>

    <main className={styles.main}>
      <header className={styles.topbar}><div><span>ScopeLogic Client Relationships</span><h1>{view==='dashboard'?'Relationship Dashboard':view==='clients'?'Clients & Contacts':view==='communications'?'Communication Audit Trail':view==='projects'?'Projects & Billing':'Follow-Ups'}</h1></div><div className={styles.actions}><button onClick={openClient}>+ Client</button><button onClick={()=>openCommunication()}>Log Communication</button><button onClick={exportJson}>Export JSON</button></div></header>
      <div className={styles.previewBanner}><b>Relationship-focused CRM.</b> Communication history, follow-ups, project history, invoices, payments received, and balances due. Preview data stays in this browser only.</div>
      {notice&&<div className={styles.notice}>{notice}</div>}

      {view==='dashboard'&&<section>
        <div className={styles.metrics}><Metric label="Follow-Ups Due" value={String(dueFollowUps.length)} alert={dueFollowUps.length>0}/><Metric label="Active Clients" value={String(data.companies.filter(x=>x.status==='Active Client').length)}/><Metric label="Active Projects" value={String(activeProjects.length)}/><Metric label="Outstanding A/R" value={money(outstandingAR)} alert={outstandingAR>0}/><Metric label="Payments Received YTD" value={money(paymentsYtd)}/><Metric label="All-Time Payments" value={money(paymentsAllTime)}/></div>
        <div className={styles.gridTwo}><Panel title="Follow-Ups Due" action={<button onClick={()=>setView('followups')}>View all</button>}>{!dueFollowUps.length?<Empty text="No follow-ups due."/>:dueFollowUps.slice(0,6).map(x=><FollowUpRow key={x.id} item={x} company={companyMap.get(x.companyId)} project={x.projectId?projectMap.get(x.projectId):undefined} onToggle={()=>completeFollowUp(x.id)}/>)}</Panel><Panel title="Outstanding Receivables" action={<button onClick={()=>setView('projects')}>Projects & billing</button>}>{!outstandingInvoices.length?<Empty text="No outstanding invoices."/>:outstandingInvoices.slice(0,6).map(inv=>{const p=projectMap.get(inv.projectId);return <div className={styles.activityRow} key={inv.id}><div className={styles.activityIcon}>$</div><div><b>{companyMap.get(p?.companyId||'')?.name} · {inv.invoiceNumber}</b><p>{p?.name}</p><span>{money(invoiceBalance(inv))} due · {inv.dueDate<today()?'OVERDUE · ':''}{inv.dueDate}</span></div></div>;})}</Panel></div>
        <div className={styles.gridTwo}><Panel title="Recent Communications">{data.communications.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(x=><CommunicationRow key={x.id} item={x} company={companyMap.get(x.companyId)} contact={x.contactId?contactMap.get(x.contactId):undefined} project={x.projectId?projectMap.get(x.projectId):undefined}/>)}</Panel><Panel title="Active Projects">{!activeProjects.length?<Empty text="No active projects."/>:activeProjects.map(p=><div className={styles.opportunityRow} key={p.id}><div><b>{p.name}</b><span>{companyMap.get(p.companyId)?.name} · {p.service}</span></div><span className={styles.stagePill}>{p.status}</span><b>{money(projectBalance(p.id))} due</b></div>)}</Panel></div>
      </section>}

      {view==='clients'&&<section><div className={styles.companyToolbar}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, contact, email, city, status..."/><button onClick={openClient}>+ New Client</button></div><div className={styles.companyGrid}><aside className={styles.companyList}>{filteredCompanies.map(c=><button key={c.id} className={selectedCompany?.id===c.id?styles.companySelected:''} onClick={()=>setSelectedCompanyId(c.id)}><b>{c.name}</b><span>{c.status}</span><small>{c.city}{c.state?`, ${c.state}`:''}</small></button>)}</aside><div className={styles.companyDetail}>{selectedCompany&&<><div className={styles.companyHead}><div><span>{selectedCompany.type} · {selectedCompany.status}</span><h2>{selectedCompany.name}</h2><p>{selectedCompany.city}{selectedCompany.state?`, ${selectedCompany.state}`:''}</p></div><div className={styles.actions}><button onClick={()=>openContact(selectedCompany.id)}>+ Contact</button><button onClick={()=>openCommunication(selectedCompany.id)}>Log Communication</button><button onClick={()=>openFollowUp(selectedCompany.id)}>Follow-Up</button><button onClick={()=>openProject(selectedCompany.id)}>+ Project</button></div></div><div className={styles.detailCards}><div><span>Lifetime Project Fees</span><b>{money(selectedProjects.reduce((s,p)=>s+p.contractValue,0))}</b></div><div><span>Payments Received</span><b>{money(selectedProjects.reduce((s,p)=>s+projectPaid(p.id),0))}</b></div><div><span>Outstanding</span><b>{money(selectedProjects.reduce((s,p)=>s+projectBalance(p.id),0))}</b></div></div><div className={styles.notes}>{selectedCompany.notes||'No relationship notes yet.'}</div><Panel title="Contacts" action={<button onClick={()=>openContact(selectedCompany.id)}>+ Contact</button>}>{!selectedContacts.length?<Empty text="No contacts saved."/>:<div className={styles.contactCards}>{selectedContacts.map(c=><div key={c.id} className={styles.contactCard}><b>{c.name}</b><span>{c.title||'Title not entered'}</span><a href={c.email?`mailto:${c.email}`:undefined}>{c.email||'Email not entered'}</a><small>{c.phone||'Phone not entered'}</small></div>)}</div>}</Panel><Panel title="Project History"><ProjectTable projects={selectedProjects} companyMap={companyMap} projectInvoiced={projectInvoiced} projectPaid={projectPaid} projectBalance={projectBalance}/></Panel><Panel title="Communication Audit Trail">{!selectedComms.length?<Empty text="No communications logged."/>:selectedComms.map(x=><CommunicationRow key={x.id} item={x} company={selectedCompany} contact={x.contactId?contactMap.get(x.contactId):undefined} project={x.projectId?projectMap.get(x.projectId):undefined}/>)}</Panel><Panel title="Open Follow-Ups">{!selectedFollowUps.length?<Empty text="No open follow-ups."/>:selectedFollowUps.map(x=><FollowUpRow key={x.id} item={x} company={selectedCompany} project={x.projectId?projectMap.get(x.projectId):undefined} onToggle={()=>completeFollowUp(x.id)}/>)}</Panel></>}</div></div></section>}

      {view==='communications'&&<section><div className={styles.taskHeader}><div><h2>Communication Audit Trail</h2><p>Chronological record of outreach, responses, calls, meetings, documents, and notes.</p></div><button onClick={()=>openCommunication()}>+ Log Communication</button></div><Panel title="All Communications">{data.communications.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=><CommunicationRow key={x.id} item={x} company={companyMap.get(x.companyId)} contact={x.contactId?contactMap.get(x.contactId):undefined} project={x.projectId?projectMap.get(x.projectId):undefined}/>)}</Panel></section>}

      {view==='projects'&&<section><div className={styles.taskHeader}><div><h2>Project History & Receivables</h2><p>Actual authorized fees, invoices, payments received, and balances due.</p></div><button onClick={()=>openProject()}>+ New Project</button></div><Panel title="All Projects"><ProjectTable projects={data.projects} companyMap={companyMap} projectInvoiced={projectInvoiced} projectPaid={projectPaid} projectBalance={projectBalance} onOpen={id=>setSelectedProjectId(id)}/></Panel>{selectedProject&&<><div className={styles.companyHead}><div><span>{companyMap.get(selectedProject.companyId)?.name} · {selectedProject.status}</span><h2>{selectedProject.name}</h2><p>{selectedProject.service}</p></div><div className={styles.actions}><button onClick={()=>openCommunication(selectedProject.companyId,selectedProject.id)}>Log Communication</button><button onClick={()=>openFollowUp(selectedProject.companyId,selectedProject.id)}>Follow-Up</button><button onClick={()=>openInvoice(selectedProject.id)}>+ Invoice</button><button onClick={()=>openPayment()}>+ Payment</button></div></div><div className={styles.detailCards}><div><span>Authorized Fee</span><b>{money(selectedProject.contractValue)}</b></div><div><span>Paid</span><b>{money(projectPaid(selectedProject.id))}</b></div><div><span>Balance Due</span><b>{money(projectBalance(selectedProject.id))}</b></div></div><Panel title="Invoices & Payments"><div className={styles.tableWrap}><table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>{projectInvoices(selectedProject.id).map(inv=><tr key={inv.id}><td><b>{inv.invoiceNumber}</b></td><td>{inv.issuedDate}</td><td>{inv.dueDate}</td><td>{money(inv.amount)}</td><td>{money(invoicePaid(inv.id))}</td><td>{money(invoiceBalance(inv))}</td><td>{invoiceBalance(inv)>0&&<button onClick={()=>openPayment(inv.id)}>Record Payment</button>}</td></tr>)}</tbody></table></div></Panel></>}</section>}

      {view==='followups'&&<section><div className={styles.taskHeader}><div><h2>Client Follow-Ups</h2><p>Prospect outreach, active-client check-ins, payment follow-ups, and past-client touches.</p></div><button onClick={()=>openFollowUp()}>+ Follow-Up</button></div><div className={styles.taskList}>{openFollowUps.map(x=><FollowUpRow key={x.id} item={x} company={companyMap.get(x.companyId)} project={x.projectId?projectMap.get(x.projectId):undefined} onToggle={()=>completeFollowUp(x.id)}/>)}</div><Panel title="Completed Follow-Ups">{data.followUps.filter(x=>x.completed).map(x=><FollowUpRow key={x.id} item={x} company={companyMap.get(x.companyId)} project={x.projectId?projectMap.get(x.projectId):undefined} onToggle={()=>completeFollowUp(x.id)}/>)}</Panel></section>}

      <footer className={styles.footer}><button onClick={()=>setModal('reset')}>Reset demo data</button><span>Browser-local CRM prototype. No production database writes.</span></footer>
    </main>

    {modal&&<Modal title={modalTitle(modal)} wide={modal==='communication'} onClose={closeModal}><form onSubmit={submitModal} className={styles.modalForm}>
      {modal==='client'&&<><div className={styles.formGrid}><Field label="Company / Client Name"><input required value={draft.name} onChange={e=>update('name',e.target.value)}/></Field><Field label="Relationship Status"><select value={draft.relationshipStatus} onChange={e=>update('relationshipStatus',e.target.value as RelationshipStatus)}><option>Prospect</option><option>Active Client</option><option>Past Client</option><option>Dormant</option></select></Field><Field label="Company Type"><select value={draft.companyType} onChange={e=>update('companyType',e.target.value as Company['type'])}><option>GC</option><option>CM</option><option>Owner</option><option>Other</option></select></Field><Field label="Website"><input value={draft.website} onChange={e=>update('website',e.target.value)}/></Field><Field label="City"><input value={draft.city} onChange={e=>update('city',e.target.value)}/></Field><Field label="State"><input value={draft.state} onChange={e=>update('state',e.target.value)}/></Field></div><Field label="Relationship Notes"><textarea rows={4} value={draft.notes} onChange={e=>update('notes',e.target.value)}/></Field></>}
      {modal==='contact'&&<><ClientSelect data={data} value={draft.companyId} onChange={v=>update('companyId',v)}/><div className={styles.formGrid}><Field label="Name"><input required value={draft.name} onChange={e=>update('name',e.target.value)}/></Field><Field label="Title"><input value={draft.title} onChange={e=>update('title',e.target.value)}/></Field><Field label="Email"><input type="email" value={draft.email} onChange={e=>update('email',e.target.value)}/></Field><Field label="Phone"><input value={draft.phone} onChange={e=>update('phone',e.target.value)}/></Field></div></>}
      {modal==='communication'&&<CommunicationForm draft={draft} data={data} update={update}/>} 
      {modal==='followup'&&<><div className={styles.formGrid}><ClientSelect data={data} value={draft.companyId} onChange={v=>{update('companyId',v);update('contactId','');update('projectId','');}}/><ContactSelect data={data} companyId={draft.companyId} value={draft.contactId} onChange={v=>update('contactId',v)}/><ProjectSelect data={data} companyId={draft.companyId} value={draft.projectId} onChange={v=>update('projectId',v)}/><Field label="Due Date"><input type="date" value={draft.followUpDate} onChange={e=>update('followUpDate',e.target.value)}/></Field></div><Field label="Follow-Up Action"><textarea required rows={3} value={draft.followUpTitle} onChange={e=>update('followUpTitle',e.target.value)}/></Field></>}
      {modal==='project'&&<><div className={styles.formGrid}><ClientSelect data={data} value={draft.companyId} onChange={v=>update('companyId',v)}/><Field label="Project Name"><input required value={draft.name} onChange={e=>update('name',e.target.value)}/></Field><Field label="Service"><input value={draft.service} onChange={e=>update('service',e.target.value)}/></Field><Field label="Status"><select value={draft.projectStatus} onChange={e=>update('projectStatus',e.target.value as ProjectStatus)}><option>Upcoming</option><option>Active</option><option>Complete</option><option>On Hold</option><option>Cancelled</option></select></Field><Field label="Authorized Fee"><input type="number" min="0" step="0.01" value={draft.contractValue} onChange={e=>update('contractValue',e.target.value)}/></Field><Field label="Start Date"><input type="date" value={draft.startDate} onChange={e=>update('startDate',e.target.value)}/></Field><Field label="Target Date"><input type="date" value={draft.targetDate} onChange={e=>update('targetDate',e.target.value)}/></Field></div><Field label="Project Notes"><textarea rows={4} value={draft.notes} onChange={e=>update('notes',e.target.value)}/></Field></>}
      {modal==='invoice'&&<><div className={styles.formGrid}><ProjectSelect data={data} value={draft.projectId} onChange={v=>update('projectId',v)}/><Field label="Invoice Number"><input required value={draft.invoiceNumber} onChange={e=>update('invoiceNumber',e.target.value)}/></Field><Field label="Amount"><input type="number" min="0" step="0.01" value={draft.amount} onChange={e=>update('amount',e.target.value)}/></Field><Field label="Issued Date"><input type="date" value={draft.issuedDate} onChange={e=>update('issuedDate',e.target.value)}/></Field><Field label="Due Date"><input type="date" value={draft.dueDate} onChange={e=>update('dueDate',e.target.value)}/></Field></div><Field label="Invoice Notes"><textarea rows={3} value={draft.notes} onChange={e=>update('notes',e.target.value)}/></Field></>}
      {modal==='payment'&&<><div className={styles.formGrid}><Field label="Invoice"><select value={draft.invoiceId} onChange={e=>update('invoiceId',e.target.value)}>{data.invoices.filter(i=>invoiceBalance(i)>0).map(i=><option key={i.id} value={i.id}>{i.invoiceNumber} · {projectMap.get(i.projectId)?.name}</option>)}</select></Field><Field label="Amount Received"><input type="number" min="0.01" step="0.01" required value={draft.amount} onChange={e=>update('amount',e.target.value)}/></Field><Field label="Payment Date"><input type="date" value={draft.date} onChange={e=>update('date',e.target.value)}/></Field><Field label="Method / Reference"><input value={draft.reference} onChange={e=>update('reference',e.target.value)}/></Field></div></>}
      {modal==='reset'&&<div className={styles.confirmText}><b>Reset CRM preview data?</b><p>This removes the browser-local test records you have entered and restores the original demo data. Production ScopeLogic data is not affected.</p></div>}
      <div className={styles.modalActions}><button type="button" onClick={closeModal}>Cancel</button>{modal==='reset'?<button type="button" className={styles.primaryButton} onClick={resetDemo}>Reset Demo Data</button>:<button type="submit" className={styles.primaryButton}>Save</button>}</div>
    </form></Modal>}
  </div>;
}

function modalTitle(kind:Exclude<ModalKind,null>){return kind==='client'?'Add Client':kind==='contact'?'Add Contact':kind==='communication'?'Log Communication':kind==='followup'?'Add Follow-Up':kind==='project'?'Add Project':kind==='invoice'?'Record Invoice':kind==='payment'?'Record Payment':'Reset Demo Data';}
function Modal({title,wide,onClose,children}:{title:string;wide?:boolean;onClose:()=>void;children:ReactNode}){return <div className={styles.modalBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className={`${styles.modalCard} ${wide?styles.modalWide:''}`} role="dialog" aria-modal="true" aria-label={title}><header><div><span>ScopeLogic CRM</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><div className={styles.modalBody}>{children}</div></section></div>;}
function Field({label,children}:{label:string;children:ReactNode}){return <label className={styles.field}><span>{label}</span>{children}</label>;}
function ClientSelect({data,value,onChange}:{data:CrmData;value:string;onChange:(v:string)=>void}){return <Field label="Client"><select required value={value} onChange={e=>onChange(e.target.value)}><option value="">Select client…</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>;}
function ContactSelect({data,companyId,value,onChange}:{data:CrmData;companyId:string;value:string;onChange:(v:string)=>void}){return <Field label="Contact"><select value={value} onChange={e=>onChange(e.target.value)}><option value="">No specific contact</option>{data.contacts.filter(c=>!companyId||c.companyId===companyId).map(c=><option key={c.id} value={c.id}>{c.name} · {c.title}</option>)}</select></Field>;}
function ProjectSelect({data,companyId,value,onChange}:{data:CrmData;companyId?:string;value:string;onChange:(v:string)=>void}){return <Field label="Project"><select value={value} onChange={e=>onChange(e.target.value)}><option value="">No project / general relationship</option>{data.projects.filter(p=>!companyId||p.companyId===companyId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>;}
function CommunicationForm({draft,data,update}:{draft:Draft;data:CrmData;update:<K extends keyof Draft>(k:K,v:Draft[K])=>void}){return <><div className={styles.formGrid}><ClientSelect data={data} value={draft.companyId} onChange={v=>{update('companyId',v);update('contactId','');update('projectId','');}}/><ContactSelect data={data} companyId={draft.companyId} value={draft.contactId} onChange={v=>update('contactId',v)}/><ProjectSelect data={data} companyId={draft.companyId} value={draft.projectId} onChange={v=>update('projectId',v)}/><Field label="Date"><input type="date" value={draft.date} onChange={e=>update('date',e.target.value)}/></Field><Field label="Type"><select value={draft.communicationType} onChange={e=>update('communicationType',e.target.value as CommunicationType)}><option>Email</option><option>Call</option><option>Teams</option><option>Meeting</option><option>Text</option><option>Document</option><option>Note</option></select></Field><Field label="Direction"><select value={draft.direction} onChange={e=>update('direction',e.target.value as Direction)}><option>Outgoing</option><option>Incoming</option><option>Internal</option></select></Field></div><Field label="Subject / Short Title"><input value={draft.subject} onChange={e=>update('subject',e.target.value)}/></Field><Field label="Communication Summary"><textarea required rows={6} value={draft.summary} onChange={e=>update('summary',e.target.value)} placeholder="What was discussed, sent, requested, decided, or promised?"/></Field><label className={styles.checkRow}><input type="checkbox" checked={draft.createFollowUp} onChange={e=>update('createFollowUp',e.target.checked)}/><span>Create a follow-up from this communication</span></label>{draft.createFollowUp&&<div className={styles.formGrid}><Field label="Follow-Up Action"><input required value={draft.followUpTitle} onChange={e=>update('followUpTitle',e.target.value)}/></Field><Field label="Follow-Up Date"><input type="date" value={draft.followUpDate} onChange={e=>update('followUpDate',e.target.value)}/></Field></div>}</>;}
function Metric({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div className={`${styles.metric} ${alert?styles.metricAlert:''}`}><span>{label}</span><b>{value}</b></div>;}
function Panel({title,action,children}:{title:string;action?:ReactNode;children:ReactNode}){return <section className={styles.panel}><header><h2>{title}</h2>{action}</header><div>{children}</div></section>;}
function Empty({text}:{text:string}){return <div className={styles.empty}>{text}</div>;}
function CommunicationRow({item,company,contact,project}:{item:Communication;company?:Company;contact?:Contact;project?:Project}){return <div className={styles.activityRow}><div className={styles.activityIcon}>{item.type.slice(0,1)}</div><div><b>{company?.name||'Client'}{contact?` · ${contact.name}`:''}</b><p>{item.subject?`${item.subject} — `:''}{item.summary}</p><span>{item.date} · {item.type} · {item.direction}{project?` · ${project.name}`:''}</span></div></div>;}
function FollowUpRow({item,company,project,onToggle}:{item:FollowUp;company?:Company;project?:Project;onToggle:()=>void}){const overdue=!item.completed&&item.dueDate<today();const dueToday=!item.completed&&item.dueDate===today();return <div className={`${styles.taskRow} ${overdue?styles.overdue:''}`}><button className={styles.taskCheck} onClick={onToggle}>{item.completed?'✓':''}</button><div><b>{item.title}</b><span>{company?.name||'Client'}{project?` · ${project.name}`:''}</span></div><small>{overdue?'Overdue · ':dueToday?'Due today · ':''}{item.dueDate}</small></div>;}
function ProjectTable({projects,companyMap,projectInvoiced,projectPaid,projectBalance,onOpen}:{projects:Project[];companyMap:Map<string,Company>;projectInvoiced:(id:string)=>number;projectPaid:(id:string)=>number;projectBalance:(id:string)=>number;onOpen?:(id:string)=>void}){if(!projects.length)return <Empty text="No projects yet."/>;return <div className={styles.tableWrap}><table><thead><tr><th>Client</th><th>Project</th><th>Service</th><th>Status</th><th>Fee</th><th>Invoiced</th><th>Paid</th><th>Balance</th>{onOpen&&<th></th>}</tr></thead><tbody>{projects.map(p=><tr key={p.id}><td>{companyMap.get(p.companyId)?.name}</td><td><b>{p.name}</b></td><td>{p.service}</td><td>{p.status}</td><td>{money(p.contractValue)}</td><td>{money(projectInvoiced(p.id))}</td><td>{money(projectPaid(p.id))}</td><td>{money(projectBalance(p.id))}</td>{onOpen&&<td><button onClick={()=>onOpen(p.id)}>Open</button></td>}</tr>)}</tbody></table></div>;}
