'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import styles from './crm-preview.module.css';

type View = 'dashboard' | 'clients' | 'communications' | 'projects' | 'followups';
type RelationshipStatus = 'Prospect' | 'Active Client' | 'Past Client' | 'Dormant';
type ProjectStatus = 'Upcoming' | 'Active' | 'Complete' | 'On Hold' | 'Cancelled';
type CommunicationType = 'Email' | 'Call' | 'Teams' | 'Meeting' | 'Text' | 'Document' | 'Note';
type Direction = 'Outgoing' | 'Incoming' | 'Internal';

type Company = {
  id: string;
  name: string;
  type: 'GC' | 'CM' | 'Owner' | 'Other';
  status: RelationshipStatus;
  website: string;
  city: string;
  state: string;
  notes: string;
};

type Contact = {
  id: string;
  companyId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

type Project = {
  id: string;
  companyId: string;
  name: string;
  service: string;
  status: ProjectStatus;
  contractValue: number;
  startDate: string;
  targetDate: string;
  completedDate: string;
  notes: string;
};

type Invoice = {
  id: string;
  projectId: string;
  invoiceNumber: string;
  amount: number;
  issuedDate: string;
  dueDate: string;
  notes: string;
};

type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  reference: string;
};

type Communication = {
  id: string;
  companyId: string;
  contactId?: string;
  projectId?: string;
  type: CommunicationType;
  direction: Direction;
  date: string;
  subject: string;
  summary: string;
};

type FollowUp = {
  id: string;
  companyId: string;
  contactId?: string;
  projectId?: string;
  title: string;
  dueDate: string;
  completed: boolean;
};

type CrmData = {
  companies: Company[];
  contacts: Contact[];
  projects: Project[];
  invoices: Invoice[];
  payments: Payment[];
  communications: Communication[];
  followUps: FollowUp[];
};

const storageKey = 'scopelogic-crm-preview-v2';
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const yearShift = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
};
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

function seedData(): CrmData {
  return {
    companies: [
      { id: 'c1', name: 'Demo Prospective GC', type: 'GC', status: 'Prospect', website: 'https://example.com', city: 'Atlanta', state: 'GA', notes: 'Potential client. Introductory ScopeLogic information has been sent.' },
      { id: 'c2', name: 'Demo Active GC', type: 'GC', status: 'Active Client', website: '', city: 'Charlotte', state: 'NC', notes: 'Existing client with both Quick Review and larger-project history.' },
      { id: 'c3', name: 'Demo Past Client', type: 'CM', status: 'Past Client', website: '', city: 'Nashville', state: 'TN', notes: 'Completed prior engagement. Keep relationship warm.' },
    ],
    contacts: [
      { id: 'ct1', companyId: 'c1', name: 'Alex Morgan', title: 'Preconstruction Manager', email: 'alex@example.com', phone: '' },
      { id: 'ct2', companyId: 'c2', name: 'Jordan Lee', title: 'Senior Estimator', email: 'jordan@example.com', phone: '' },
      { id: 'ct3', companyId: 'c2', name: 'Casey Brown', title: 'Project Executive', email: 'casey@example.com', phone: '' },
      { id: 'ct4', companyId: 'c3', name: 'Taylor Smith', title: 'Director of Preconstruction', email: 'taylor@example.com', phone: '' },
    ],
    projects: [
      { id: 'p1', companyId: 'c2', name: 'Retail TI Quick Review', service: 'P1 + P2 Quick Review', status: 'Active', contractValue: 450, startDate: addDays(-4), targetDate: addDays(2), completedDate: '', notes: 'Current small-project pilot.' },
      { id: 'p2', companyId: 'c2', name: 'Corporate Campus Technology Review', service: 'Product 1 — Technology Scope & Risk Assessment', status: 'Complete', contractValue: 3500, startDate: addDays(-90), targetDate: addDays(-65), completedDate: addDays(-62), notes: 'Completed and paid.' },
      { id: 'p3', companyId: 'c3', name: 'School Renovation Bid Validation', service: 'Product 2 — Bid Analysis & Budget Validation', status: 'Complete', contractValue: 2750, startDate: yearShift(-1), targetDate: yearShift(-1), completedDate: yearShift(-1), notes: 'Prior-year completed engagement.' },
    ],
    invoices: [
      { id: 'i1', projectId: 'p1', invoiceNumber: 'SL-1001', amount: 450, issuedDate: addDays(-3), dueDate: addDays(27), notes: 'Net 30.' },
      { id: 'i2', projectId: 'p2', invoiceNumber: 'SL-0987', amount: 3500, issuedDate: addDays(-70), dueDate: addDays(-40), notes: '' },
      { id: 'i3', projectId: 'p3', invoiceNumber: 'SL-0812', amount: 2750, issuedDate: yearShift(-1), dueDate: yearShift(-1), notes: '' },
    ],
    payments: [
      { id: 'pay1', invoiceId: 'i2', amount: 3500, paymentDate: addDays(-38), reference: 'ACH' },
      { id: 'pay2', invoiceId: 'i3', amount: 2750, paymentDate: yearShift(-1), reference: 'ACH' },
    ],
    communications: [
      { id: 'com1', companyId: 'c1', contactId: 'ct1', type: 'Email', direction: 'Outgoing', date: today(), subject: 'ScopeLogic Introduction', summary: 'Sent introductory email with both one-page ScopeLogic service overviews.' },
      { id: 'com2', companyId: 'c2', contactId: 'ct2', projectId: 'p1', type: 'Email', direction: 'Incoming', date: addDays(-4), subject: 'Retail TI project', summary: 'Client sent drawings and asked ScopeLogic to try the project.' },
      { id: 'com3', companyId: 'c2', contactId: 'ct2', projectId: 'p1', type: 'Email', direction: 'Outgoing', date: addDays(-3), subject: 'Project authorization', summary: 'Confirmed Quick Review scope, fee, turnaround, and sent project authorization.' },
      { id: 'com4', companyId: 'c2', contactId: 'ct3', projectId: 'p2', type: 'Teams', direction: 'Outgoing', date: addDays(-62), subject: 'Final review meeting', summary: 'Reviewed final Technology Scope & Risk Assessment findings with project team.' },
      { id: 'com5', companyId: 'c3', contactId: 'ct4', projectId: 'p3', type: 'Email', direction: 'Outgoing', date: yearShift(-1), subject: 'Final bid validation', summary: 'Delivered final bid comparison and recommendation.' },
    ],
    followUps: [
      { id: 'f1', companyId: 'c1', contactId: 'ct1', title: 'Follow up on ScopeLogic introduction', dueDate: addDays(7), completed: false },
      { id: 'f2', companyId: 'c2', contactId: 'ct2', projectId: 'p1', title: 'Confirm Quick Review delivery and invoice status', dueDate: addDays(2), completed: false },
      { id: 'f3', companyId: 'c3', contactId: 'ct4', title: 'Relationship check-in with past client', dueDate: today(), completed: false },
    ],
  };
}

export default function CrmPreviewClient({ userEmail }: { userEmail: string }) {
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<CrmData>(() => seedData());
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('c1');
  const [selectedProjectId, setSelectedProjectId] = useState('p1');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setData(JSON.parse(saved) as CrmData);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, hydrated]);

  const companyMap = useMemo(() => new Map(data.companies.map((item) => [item.id, item])), [data.companies]);
  const contactMap = useMemo(() => new Map(data.contacts.map((item) => [item.id, item])), [data.contacts]);
  const projectMap = useMemo(() => new Map(data.projects.map((item) => [item.id, item])), [data.projects]);
  const invoiceMap = useMemo(() => new Map(data.invoices.map((item) => [item.id, item])), [data.invoices]);

  const invoicePaid = (invoiceId: string) => data.payments.filter((payment) => payment.invoiceId === invoiceId).reduce((sum, payment) => sum + payment.amount, 0);
  const invoiceBalance = (invoice: Invoice) => Math.max(0, invoice.amount - invoicePaid(invoice.id));
  const projectInvoices = (projectId: string) => data.invoices.filter((invoice) => invoice.projectId === projectId);
  const projectInvoiced = (projectId: string) => projectInvoices(projectId).reduce((sum, invoice) => sum + invoice.amount, 0);
  const projectPaid = (projectId: string) => projectInvoices(projectId).reduce((sum, invoice) => sum + invoicePaid(invoice.id), 0);
  const projectBalance = (projectId: string) => projectInvoices(projectId).reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);

  const selectedCompany = data.companies.find((company) => company.id === selectedCompanyId) || data.companies[0];
  const selectedProject = data.projects.find((project) => project.id === selectedProjectId) || data.projects[0];
  const selectedContacts = data.contacts.filter((contact) => contact.companyId === selectedCompany?.id);
  const selectedProjects = data.projects.filter((project) => project.companyId === selectedCompany?.id);
  const selectedCommunications = data.communications.filter((communication) => communication.companyId === selectedCompany?.id).sort((a, b) => b.date.localeCompare(a.date));
  const selectedFollowUps = data.followUps.filter((followUp) => followUp.companyId === selectedCompany?.id && !followUp.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const openFollowUps = data.followUps.filter((item) => !item.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueFollowUps = openFollowUps.filter((item) => item.dueDate <= today());
  const activeProjects = data.projects.filter((item) => item.status === 'Active' || item.status === 'Upcoming');
  const outstandingInvoices = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const outstandingAR = outstandingInvoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const currentYear = new Date().getFullYear();
  const paymentsYtd = data.payments.filter((payment) => new Date(payment.paymentDate).getFullYear() === currentYear).reduce((sum, payment) => sum + payment.amount, 0);
  const paymentsAllTime = data.payments.reduce((sum, payment) => sum + payment.amount, 0);

  const filteredCompanies = data.companies.filter((company) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    const contacts = data.contacts.filter((contact) => contact.companyId === company.id);
    return [company.name, company.status, company.city, company.state, company.notes, ...contacts.flatMap((contact) => [contact.name, contact.title, contact.email])].join(' ').toLowerCase().includes(needle);
  });

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
  };

  const addCompany = () => {
    const name = window.prompt('Company / client name');
    if (!name?.trim()) return;
    const status = (window.prompt('Relationship status: Prospect, Active Client, Past Client, or Dormant', 'Prospect') || 'Prospect') as RelationshipStatus;
    const valid: RelationshipStatus[] = ['Prospect', 'Active Client', 'Past Client', 'Dormant'];
    const company: Company = { id: uid(), name: name.trim(), type: 'GC', status: valid.includes(status) ? status : 'Prospect', website: '', city: '', state: '', notes: '' };
    setData((current) => ({ ...current, companies: [...current.companies, company] }));
    setSelectedCompanyId(company.id);
    setView('clients');
    flash('Client record added to browser-local preview.');
  };

  const addContact = () => {
    if (!selectedCompany) return;
    const name = window.prompt(`Contact name for ${selectedCompany.name}`);
    if (!name?.trim()) return;
    const contact: Contact = { id: uid(), companyId: selectedCompany.id, name: name.trim(), title: window.prompt('Title', 'Estimator') || '', email: window.prompt('Email', '') || '', phone: window.prompt('Phone', '') || '' };
    setData((current) => ({ ...current, contacts: [...current.contacts, contact] }));
    flash('Contact added.');
  };

  const addCommunication = (companyId = selectedCompany?.id, projectId?: string) => {
    if (!companyId) return;
    const typeInput = window.prompt('Communication type: Email, Call, Teams, Meeting, Text, Document, or Note', 'Email') || 'Note';
    const directionInput = window.prompt('Direction: Outgoing, Incoming, or Internal', 'Outgoing') || 'Outgoing';
    const subject = window.prompt('Subject / short title', '') || '';
    const summary = window.prompt('Communication summary');
    if (!summary?.trim()) return;
    const types: CommunicationType[] = ['Email', 'Call', 'Teams', 'Meeting', 'Text', 'Document', 'Note'];
    const directions: Direction[] = ['Outgoing', 'Incoming', 'Internal'];
    const companyContacts = data.contacts.filter((contact) => contact.companyId === companyId);
    const communication: Communication = { id: uid(), companyId, contactId: companyContacts[0]?.id, projectId, type: types.includes(typeInput as CommunicationType) ? typeInput as CommunicationType : 'Note', direction: directions.includes(directionInput as Direction) ? directionInput as Direction : 'Outgoing', date: today(), subject, summary: summary.trim() };
    setData((current) => ({ ...current, communications: [communication, ...current.communications] }));
    flash('Communication logged.');
  };

  const addFollowUp = (companyId = selectedCompany?.id, projectId?: string) => {
    if (!companyId) return;
    const title = window.prompt('Follow-up action');
    if (!title?.trim()) return;
    const dueDate = window.prompt('Due date (YYYY-MM-DD)', addDays(7)) || addDays(7);
    const companyContacts = data.contacts.filter((contact) => contact.companyId === companyId);
    const followUp: FollowUp = { id: uid(), companyId, contactId: companyContacts[0]?.id, projectId, title: title.trim(), dueDate, completed: false };
    setData((current) => ({ ...current, followUps: [...current.followUps, followUp] }));
    flash('Follow-up added.');
  };

  const addProject = (companyId = selectedCompany?.id) => {
    if (!companyId) return;
    const name = window.prompt('Project name');
    if (!name?.trim()) return;
    const service = window.prompt('ScopeLogic service', 'P1 + P2 Quick Review') || '';
    const contractValue = Number(window.prompt('Authorized project fee', '450') || '0');
    const project: Project = { id: uid(), companyId, name: name.trim(), service, status: 'Active', contractValue: Number.isFinite(contractValue) ? contractValue : 0, startDate: today(), targetDate: addDays(7), completedDate: '', notes: '' };
    setData((current) => ({ ...current, projects: [...current.projects, project], companies: current.companies.map((company) => company.id === companyId ? { ...company, status: 'Active Client' } : company) }));
    setSelectedProjectId(project.id);
    setView('projects');
    flash('Project added.');
  };

  const addInvoice = (projectId = selectedProject?.id) => {
    if (!projectId) return;
    const project = projectMap.get(projectId);
    const amount = Number(window.prompt('Invoice amount', String(project?.contractValue || 0)) || '0');
    const invoice: Invoice = { id: uid(), projectId, invoiceNumber: window.prompt('Invoice number', `SL-${String(data.invoices.length + 1001)}`) || '', amount: Number.isFinite(amount) ? amount : 0, issuedDate: today(), dueDate: window.prompt('Due date (YYYY-MM-DD)', addDays(30)) || addDays(30), notes: '' };
    setData((current) => ({ ...current, invoices: [...current.invoices, invoice] }));
    flash('Invoice recorded.');
  };

  const addPayment = (invoiceId?: string) => {
    const targetId = invoiceId || selectedProject && projectInvoices(selectedProject.id).find((invoice) => invoiceBalance(invoice) > 0)?.id;
    if (!targetId) return flash('No unpaid invoice is available for this project.');
    const invoice = invoiceMap.get(targetId);
    if (!invoice) return;
    const amount = Number(window.prompt('Payment amount', String(invoiceBalance(invoice))) || '0');
    if (!amount || amount < 0) return;
    const payment: Payment = { id: uid(), invoiceId: targetId, amount, paymentDate: today(), reference: window.prompt('Payment reference / method', 'ACH') || '' };
    setData((current) => ({ ...current, payments: [...current.payments, payment] }));
    flash('Payment recorded.');
  };

  const completeFollowUp = (id: string) => setData((current) => ({ ...current, followUps: current.followUps.map((item) => item.id === id ? { ...item, completed: !item.completed } : item) }));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ScopeLogic-CRM-Preview-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetDemo = () => {
    if (!window.confirm('Reset the browser-local CRM preview to demo data?')) return;
    const next = seedData();
    setData(next);
    setSelectedCompanyId(next.companies[0]?.id || '');
    setSelectedProjectId(next.projects[0]?.id || '');
  };

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <a href="/" className={styles.brand}><img src="/brand/scopelogic-logo-full.png" alt="ScopeLogic" /></a>
      <div className={styles.previewTag}>CLIENT CRM · PREVIEW ONLY</div>
      <nav className={styles.nav}>
        <button className={view === 'dashboard' ? styles.active : ''} onClick={() => setView('dashboard')}>Relationship Dashboard</button>
        <button className={view === 'clients' ? styles.active : ''} onClick={() => setView('clients')}>Clients & Contacts</button>
        <button className={view === 'communications' ? styles.active : ''} onClick={() => setView('communications')}>Communications</button>
        <button className={view === 'projects' ? styles.active : ''} onClick={() => setView('projects')}>Projects & Billing</button>
        <button className={view === 'followups' ? styles.active : ''} onClick={() => setView('followups')}>Follow-Ups</button>
      </nav>
      <div className={styles.sidebarFoot}><span>Signed in</span><b>{userEmail}</b><a href="/">← Back to ScopeLogic</a></div>
    </aside>

    <main className={styles.main}>
      <header className={styles.topbar}>
        <div><span>ScopeLogic Client Relationships</span><h1>{view === 'dashboard' ? 'Relationship Dashboard' : view === 'clients' ? 'Clients & Contacts' : view === 'communications' ? 'Communication Audit Trail' : view === 'projects' ? 'Projects & Billing' : 'Follow-Ups'}</h1></div>
        <div className={styles.actions}><button onClick={addCompany}>+ Client</button><button onClick={() => addCommunication()}>Log Communication</button><button onClick={exportJson}>Export JSON</button></div>
      </header>

      <div className={styles.previewBanner}><b>No sales forecasting.</b> This CRM is centered on relationship follow-up, communication history, project history, invoices, payments received, and balances due. Preview data stays in this browser only.</div>
      {notice && <div className={styles.notice}>{notice}</div>}

      {view === 'dashboard' && <section>
        <div className={styles.metrics}>
          <Metric label="Follow-Ups Due" value={String(dueFollowUps.length)} alert={dueFollowUps.length > 0} />
          <Metric label="Active Clients" value={String(data.companies.filter((item) => item.status === 'Active Client').length)} />
          <Metric label="Active Projects" value={String(activeProjects.length)} />
          <Metric label="Outstanding A/R" value={money(outstandingAR)} alert={outstandingAR > 0} />
          <Metric label="Payments Received YTD" value={money(paymentsYtd)} />
          <Metric label="All-Time Payments" value={money(paymentsAllTime)} />
        </div>
        <div className={styles.gridTwo}>
          <Panel title="Follow-Ups Due" action={<button onClick={() => setView('followups')}>View all</button>}>
            {!dueFollowUps.length ? <Empty text="No follow-ups due." /> : dueFollowUps.slice(0, 6).map((item) => <FollowUpRow key={item.id} item={item} company={companyMap.get(item.companyId)} project={item.projectId ? projectMap.get(item.projectId) : undefined} onToggle={() => completeFollowUp(item.id)} />)}
          </Panel>
          <Panel title="Outstanding Receivables" action={<button onClick={() => setView('projects')}>Projects & billing</button>}>
            {!outstandingInvoices.length ? <Empty text="No outstanding invoices." /> : outstandingInvoices.slice(0, 6).map((invoice) => {
              const project = projectMap.get(invoice.projectId); const overdue = invoice.dueDate < today();
              return <div className={styles.activityRow} key={invoice.id}><div className={styles.activityIcon}>$</div><div><b>{companyMap.get(project?.companyId || '')?.name} · {invoice.invoiceNumber}</b><p>{project?.name}</p><span>{money(invoiceBalance(invoice))} due · {overdue ? 'OVERDUE · ' : ''}{invoice.dueDate}</span></div></div>;
            })}
          </Panel>
        </div>
        <div className={styles.gridTwo}>
          <Panel title="Recent Communications">
            {data.communications.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((item) => <CommunicationRow key={item.id} item={item} company={companyMap.get(item.companyId)} contact={item.contactId ? contactMap.get(item.contactId) : undefined} project={item.projectId ? projectMap.get(item.projectId) : undefined} />)}
          </Panel>
          <Panel title="Active Projects">
            {!activeProjects.length ? <Empty text="No active projects." /> : activeProjects.map((project) => <div className={styles.opportunityRow} key={project.id}><div><b>{project.name}</b><span>{companyMap.get(project.companyId)?.name} · {project.service}</span></div><span className={styles.stagePill}>{project.status}</span><b>{money(projectBalance(project.id))} due</b></div>)}
          </Panel>
        </div>
      </section>}

      {view === 'clients' && <section>
        <div className={styles.companyToolbar}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, contact, email, city, status..." /><button onClick={addCompany}>+ New Client</button></div>
        <div className={styles.companyGrid}>
          <aside className={styles.companyList}>{filteredCompanies.map((company) => <button key={company.id} className={selectedCompany?.id === company.id ? styles.companySelected : ''} onClick={() => setSelectedCompanyId(company.id)}><b>{company.name}</b><span>{company.status}</span><small>{company.city}{company.state ? `, ${company.state}` : ''}</small></button>)}</aside>
          <div className={styles.companyDetail}>{selectedCompany ? <>
            <div className={styles.companyHead}><div><span>{selectedCompany.type} · {selectedCompany.status}</span><h2>{selectedCompany.name}</h2><p>{selectedCompany.city}{selectedCompany.state ? `, ${selectedCompany.state}` : ''}</p></div><div className={styles.actions}><button onClick={addContact}>+ Contact</button><button onClick={() => addCommunication(selectedCompany.id)}>Log Communication</button><button onClick={() => addFollowUp(selectedCompany.id)}>Follow-Up</button><button onClick={() => addProject(selectedCompany.id)}>+ Project</button></div></div>
            <div className={styles.detailCards}><div><span>Lifetime Project Fees</span><b>{money(selectedProjects.reduce((sum, project) => sum + project.contractValue, 0))}</b></div><div><span>Payments Received</span><b>{money(selectedProjects.reduce((sum, project) => sum + projectPaid(project.id), 0))}</b></div><div><span>Outstanding</span><b>{money(selectedProjects.reduce((sum, project) => sum + projectBalance(project.id), 0))}</b></div></div>
            <div className={styles.notes}>{selectedCompany.notes || 'No relationship notes yet.'}</div>
            <Panel title="Contacts" action={<button onClick={addContact}>+ Contact</button>}>
              {!selectedContacts.length ? <Empty text="No contacts saved." /> : <div className={styles.contactCards}>{selectedContacts.map((contact) => <div key={contact.id} className={styles.contactCard}><b>{contact.name}</b><span>{contact.title || 'Title not entered'}</span><a href={contact.email ? `mailto:${contact.email}` : undefined}>{contact.email || 'Email not entered'}</a><small>{contact.phone || 'Phone not entered'}</small></div>)}</div>}
            </Panel>
            <Panel title="Project History">
              {!selectedProjects.length ? <Empty text="No projects for this client yet." /> : <div className={styles.tableWrap}><table><thead><tr><th>Project</th><th>Service</th><th>Status</th><th>Fee</th><th>Invoiced</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{selectedProjects.map((project) => <tr key={project.id}><td><b>{project.name}</b></td><td>{project.service}</td><td>{project.status}</td><td>{money(project.contractValue)}</td><td>{money(projectInvoiced(project.id))}</td><td>{money(projectPaid(project.id))}</td><td>{money(projectBalance(project.id))}</td></tr>)}</tbody></table></div>}
            </Panel>
            <Panel title="Communication Audit Trail">
              {!selectedCommunications.length ? <Empty text="No communications logged." /> : selectedCommunications.map((item) => <CommunicationRow key={item.id} item={item} company={selectedCompany} contact={item.contactId ? contactMap.get(item.contactId) : undefined} project={item.projectId ? projectMap.get(item.projectId) : undefined} />)}
            </Panel>
            <Panel title="Open Follow-Ups">
              {!selectedFollowUps.length ? <Empty text="No open follow-ups." /> : selectedFollowUps.map((item) => <FollowUpRow key={item.id} item={item} company={selectedCompany} project={item.projectId ? projectMap.get(item.projectId) : undefined} onToggle={() => completeFollowUp(item.id)} />)}
            </Panel>
          </> : <Empty text="Select or add a client." />}</div>
        </div>
      </section>}

      {view === 'communications' && <section>
        <div className={styles.taskHeader}><div><h2>Communication Audit Trail</h2><p>Chronological record of outreach, responses, calls, meetings, documents, and internal notes.</p></div><button onClick={() => addCommunication()}>+ Log Communication</button></div>
        <Panel title="All Communications">
          {data.communications.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => <CommunicationRow key={item.id} item={item} company={companyMap.get(item.companyId)} contact={item.contactId ? contactMap.get(item.contactId) : undefined} project={item.projectId ? projectMap.get(item.projectId) : undefined} />)}
        </Panel>
      </section>}

      {view === 'projects' && <section>
        <div className={styles.taskHeader}><div><h2>Project History & Receivables</h2><p>Actual authorized fees, invoices, payments received, and balances due. No sales projections.</p></div><button onClick={() => addProject()}>+ New Project</button></div>
        <Panel title="All Projects">
          <div className={styles.tableWrap}><table><thead><tr><th>Client</th><th>Project</th><th>Service</th><th>Status</th><th>Fee</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>{data.projects.map((project) => <tr key={project.id}><td>{companyMap.get(project.companyId)?.name}</td><td><b>{project.name}</b></td><td>{project.service}</td><td>{project.status}</td><td>{money(project.contractValue)}</td><td>{money(projectInvoiced(project.id))}</td><td>{money(projectPaid(project.id))}</td><td><b>{money(projectBalance(project.id))}</b></td><td><button onClick={() => setSelectedProjectId(project.id)}>Open</button></td></tr>)}</tbody></table></div>
        </Panel>
        {selectedProject && <>
          <div className={styles.companyHead}><div><span>{companyMap.get(selectedProject.companyId)?.name} · {selectedProject.status}</span><h2>{selectedProject.name}</h2><p>{selectedProject.service}</p></div><div className={styles.actions}><button onClick={() => addCommunication(selectedProject.companyId, selectedProject.id)}>Log Communication</button><button onClick={() => addFollowUp(selectedProject.companyId, selectedProject.id)}>Follow-Up</button><button onClick={() => addInvoice(selectedProject.id)}>+ Invoice</button><button onClick={() => addPayment()}>+ Payment</button></div></div>
          <div className={styles.detailCards}><div><span>Authorized Fee</span><b>{money(selectedProject.contractValue)}</b></div><div><span>Paid</span><b>{money(projectPaid(selectedProject.id))}</b></div><div><span>Balance Due</span><b>{money(projectBalance(selectedProject.id))}</b></div></div>
          <Panel title="Invoices & Payments">
            {!projectInvoices(selectedProject.id).length ? <Empty text="No invoices recorded." /> : <div className={styles.tableWrap}><table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>{projectInvoices(selectedProject.id).map((invoice) => <tr key={invoice.id}><td><b>{invoice.invoiceNumber}</b></td><td>{invoice.issuedDate}</td><td>{invoice.dueDate}</td><td>{money(invoice.amount)}</td><td>{money(invoicePaid(invoice.id))}</td><td>{money(invoiceBalance(invoice))}</td><td>{invoiceBalance(invoice) > 0 && <button onClick={() => addPayment(invoice.id)}>Record Payment</button>}</td></tr>)}</tbody></table></div>}
          </Panel>
        </>}
      </section>}

      {view === 'followups' && <section>
        <div className={styles.taskHeader}><div><h2>Client Follow-Ups</h2><p>Potential-client outreach, active-client check-ins, payment follow-ups, and past-client relationship touches.</p></div><button onClick={() => addFollowUp()}>+ Follow-Up</button></div>
        <div className={styles.taskList}>{openFollowUps.map((item) => <FollowUpRow key={item.id} item={item} company={companyMap.get(item.companyId)} project={item.projectId ? projectMap.get(item.projectId) : undefined} onToggle={() => completeFollowUp(item.id)} />)}{!openFollowUps.length && <Empty text="No open follow-ups." />}</div>
        <Panel title="Completed Follow-Ups">{data.followUps.filter((item) => item.completed).map((item) => <FollowUpRow key={item.id} item={item} company={companyMap.get(item.companyId)} project={item.projectId ? projectMap.get(item.projectId) : undefined} onToggle={() => completeFollowUp(item.id)} />)}</Panel>
      </section>}

      <footer className={styles.footer}><button onClick={resetDemo}>Reset demo data</button><span>Browser-local CRM prototype. No production database writes.</span></footer>
    </main>
  </div>;
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`${styles.metric} ${alert ? styles.metricAlert : ''}`}><span>{label}</span><b>{value}</b></div>;
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className={styles.panel}><header><h2>{title}</h2>{action}</header><div>{children}</div></section>;
}

function Empty({ text }: { text: string }) { return <div className={styles.empty}>{text}</div>; }

function CommunicationRow({ item, company, contact, project }: { item: Communication; company?: Company; contact?: Contact; project?: Project }) {
  return <div className={styles.activityRow}><div className={styles.activityIcon}>{item.type.slice(0, 1)}</div><div><b>{company?.name || 'Client'}{contact ? ` · ${contact.name}` : ''}</b><p>{item.subject ? `${item.subject} — ` : ''}{item.summary}</p><span>{item.date} · {item.type} · {item.direction}{project ? ` · ${project.name}` : ''}</span></div></div>;
}

function FollowUpRow({ item, company, project, onToggle }: { item: FollowUp; company?: Company; project?: Project; onToggle: () => void }) {
  const overdue = !item.completed && item.dueDate < today();
  const dueToday = !item.completed && item.dueDate === today();
  return <div className={`${styles.taskRow} ${overdue ? styles.overdue : ''}`}><button className={styles.taskCheck} onClick={onToggle}>{item.completed ? '✓' : ''}</button><div><b>{item.title}</b><span>{company?.name || 'Client'}{project ? ` · ${project.name}` : ''}</span></div><small>{overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : ''}{item.dueDate}</small></div>;
}
