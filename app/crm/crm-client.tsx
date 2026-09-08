'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createClient } from '../../lib/supabase/client';
import styles from './crm.module.css';

type View = 'dashboard' | 'clients' | 'communications' | 'projects' | 'followups';
type RelationshipStatus = 'Prospect' | 'Active Client' | 'Past Client' | 'Dormant';
type CommunicationType = 'Email' | 'Call' | 'Teams' | 'Meeting' | 'Text' | 'Document' | 'Note';
type Direction = 'Outgoing' | 'Incoming' | 'Internal';
type ModalKind = null | 'communication' | 'followup' | 'invoice' | 'payment' | 'status';

type Customer = {
  id: string;
  company_name: string;
  crm_status: RelationshipStatus;
  city: string;
  state: string;
  website: string;
  notes: string;
};

type Contact = {
  id: string;
  customer_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

type Project = {
  id: string;
  customer_id: string | null;
  name: string;
  status: string;
  client_name: string;
  created_at: string;
  updated_at: string;
};

type Contract = {
  project_id: string;
  amount: string;
  original_contract_amount: string;
  amount_invoiced: string;
  amount_paid: string;
  contracted_service: string;
  status: string;
  start_date: string | null;
  target_completion: string | null;
};

type Communication = {
  id: string;
  customer_id: string;
  contact_id: string | null;
  project_id: string | null;
  communication_type: CommunicationType;
  direction: Direction;
  communication_date: string;
  subject: string;
  summary: string;
  created_at: string;
};

type FollowUp = {
  id: string;
  customer_id: string;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  issued_date: string;
  due_date: string;
  notes: string;
  created_at: string;
};

type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  reference: string;
  created_at: string;
};

type CrmData = {
  customers: Customer[];
  contacts: Contact[];
  projects: Project[];
  contracts: Contract[];
  communications: Communication[];
  followups: FollowUp[];
  invoices: Invoice[];
  payments: Payment[];
};

type Draft = {
  customerId: string;
  contactId: string;
  projectId: string;
  invoiceId: string;
  status: RelationshipStatus;
  communicationType: CommunicationType;
  direction: Direction;
  date: string;
  subject: string;
  summary: string;
  createFollowUp: boolean;
  followUpTitle: string;
  followUpDate: string;
  invoiceNumber: string;
  amount: string;
  issuedDate: string;
  dueDate: string;
  notes: string;
  reference: string;
};

const emptyData: CrmData = { customers: [], contacts: [], projects: [], contracts: [], communications: [], followups: [], invoices: [], payments: [] };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
const parseMoney = (value: unknown) => {
  const number = Number(String(value ?? '').replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(number) ? number : 0;
};
const draftDefaults = (): Draft => ({
  customerId: '', contactId: '', projectId: '', invoiceId: '', status: 'Prospect', communicationType: 'Email', direction: 'Outgoing', date: today(), subject: '', summary: '', createFollowUp: false, followUpTitle: '', followUpDate: addDays(7), invoiceNumber: '', amount: '', issuedDate: today(), dueDate: addDays(30), notes: '', reference: 'ACH',
});

export default function CrmClient({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<CrmData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [modal, setModal] = useState<ModalKind>(null);
  const [draft, setDraft] = useState<Draft>(() => draftDefaults());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [customers, contacts, projects, contracts, communications, followups, invoices, payments] = await Promise.all([
      supabase.from('customers').select('id, company_name, crm_status, city, state, website, notes').order('company_name'),
      supabase.from('contacts').select('id, customer_id, name, title, email, phone').order('name'),
      supabase.from('projects').select('id, customer_id, name, status, client_name, created_at, updated_at').order('updated_at', { ascending: false }),
      supabase.from('contracts').select('project_id, amount, original_contract_amount, amount_invoiced, amount_paid, contracted_service, status, start_date, target_completion'),
      supabase.from('crm_communications').select('id, customer_id, contact_id, project_id, communication_type, direction, communication_date, subject, summary, created_at').order('communication_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('crm_followups').select('id, customer_id, contact_id, project_id, title, due_date, completed_at, created_at').order('due_date'),
      supabase.from('crm_invoices').select('id, project_id, invoice_number, amount, issued_date, due_date, notes, created_at').order('due_date'),
      supabase.from('crm_payments').select('id, invoice_id, amount, payment_date, reference, created_at').order('payment_date', { ascending: false }),
    ]);
    const resultList = [customers, contacts, projects, contracts, communications, followups, invoices, payments];
    const firstError = resultList.find((result) => result.error)?.error;
    if (firstError) {
      setError(firstError.message || 'Unable to load CRM data.');
      setLoading(false);
      return;
    }
    const next: CrmData = {
      customers: (customers.data || []) as Customer[],
      contacts: (contacts.data || []) as Contact[],
      projects: (projects.data || []) as Project[],
      contracts: (contracts.data || []) as Contract[],
      communications: (communications.data || []) as Communication[],
      followups: (followups.data || []) as FollowUp[],
      invoices: ((invoices.data || []) as Invoice[]).map((item) => ({ ...item, amount: Number(item.amount || 0) })),
      payments: ((payments.data || []) as Payment[]).map((item) => ({ ...item, amount: Number(item.amount || 0) })),
    };
    setData(next);
    setSelectedCustomerId((current) => current && next.customers.some((item) => item.id === current) ? current : next.customers[0]?.id || '');
    setSelectedProjectId((current) => current && next.projects.some((item) => item.id === current) ? current : next.projects[0]?.id || '');
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const customerMap = useMemo(() => new Map(data.customers.map((item) => [item.id, item])), [data.customers]);
  const contactMap = useMemo(() => new Map(data.contacts.map((item) => [item.id, item])), [data.contacts]);
  const projectMap = useMemo(() => new Map(data.projects.map((item) => [item.id, item])), [data.projects]);
  const contractMap = useMemo(() => new Map(data.contracts.map((item) => [item.project_id, item])), [data.contracts]);
  const invoiceMap = useMemo(() => new Map(data.invoices.map((item) => [item.id, item])), [data.invoices]);

  const invoicePaid = (invoiceId: string) => data.payments.filter((payment) => payment.invoice_id === invoiceId).reduce((sum, payment) => sum + payment.amount, 0);
  const invoiceBalance = (invoice: Invoice) => Math.max(0, invoice.amount - invoicePaid(invoice.id));
  const projectInvoices = (projectId: string) => data.invoices.filter((invoice) => invoice.project_id === projectId);
  const projectCrmPaid = (projectId: string) => projectInvoices(projectId).reduce((sum, invoice) => sum + invoicePaid(invoice.id), 0);
  const projectCrmInvoiced = (projectId: string) => projectInvoices(projectId).reduce((sum, invoice) => sum + invoice.amount, 0);
  const projectAuthorized = (projectId: string) => {
    const contract = contractMap.get(projectId);
    const amount = parseMoney(contract?.amount);
    return amount > 0 ? amount : parseMoney(contract?.original_contract_amount);
  };
  const projectInvoiced = (projectId: string) => {
    const crmInvoices = projectInvoices(projectId);
    return crmInvoices.length ? projectCrmInvoiced(projectId) : parseMoney(contractMap.get(projectId)?.amount_invoiced);
  };
  const projectPaid = (projectId: string) => {
    const crmInvoices = projectInvoices(projectId);
    return crmInvoices.length ? projectCrmPaid(projectId) : parseMoney(contractMap.get(projectId)?.amount_paid);
  };
  const projectBalance = (projectId: string) => Math.max(0, projectInvoiced(projectId) - projectPaid(projectId));

  const selectedCustomer = data.customers.find((item) => item.id === selectedCustomerId) || null;
  const selectedProject = data.projects.find((item) => item.id === selectedProjectId) || null;
  const customerProjects = (customerId: string) => data.projects.filter((project) => project.customer_id === customerId);
  const customerContacts = (customerId: string) => data.contacts.filter((contact) => contact.customer_id === customerId);
  const effectiveStatus = (customer: Customer): RelationshipStatus => {
    if (customer.crm_status && customer.crm_status !== 'Prospect') return customer.crm_status;
    const projects = customerProjects(customer.id);
    if (!projects.length) return 'Prospect';
    const active = projects.some((project) => !['Complete', 'Archived', 'Cancelled'].includes(project.status));
    return active ? 'Active Client' : 'Past Client';
  };

  const activeProjects = data.projects.filter((project) => !['Complete', 'Archived', 'Cancelled'].includes(project.status));
  const openFollowups = data.followups.filter((item) => !item.completed_at);
  const dueFollowups = openFollowups.filter((item) => item.due_date <= today());
  const outstandingInvoices = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0);
  const legacyOnlyProjectBalance = data.projects.filter((project) => projectInvoices(project.id).length === 0).reduce((sum, project) => sum + projectBalance(project.id), 0);
  const outstandingAR = outstandingInvoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0) + legacyOnlyProjectBalance;
  const currentYear = new Date().getFullYear();
  const datedPaymentsYtd = data.payments.filter((payment) => new Date(`${payment.payment_date}T00:00:00`).getFullYear() === currentYear).reduce((sum, payment) => sum + payment.amount, 0);
  const allTimePayments = data.projects.reduce((sum, project) => sum + projectPaid(project.id), 0);

  const filteredCustomers = data.customers.filter((customer) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const contacts = customerContacts(customer.id);
    return [customer.company_name, effectiveStatus(customer), customer.city, customer.state, customer.website, customer.notes, ...contacts.flatMap((contact) => [contact.name, contact.title, contact.email])].join(' ').toLowerCase().includes(q);
  });

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); };
  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const closeModal = () => { if (!saving) setModal(null); };
  const seedRelation = (customerId?: string, projectId?: string) => {
    const resolvedCustomerId = customerId || (projectId ? projectMap.get(projectId)?.customer_id || '' : '') || selectedCustomerId || data.customers[0]?.id || '';
    const contacts = customerContacts(resolvedCustomerId);
    return { customerId: resolvedCustomerId, contactId: contacts[0]?.id || '', projectId: projectId || '' };
  };
  const openCommunication = (customerId?: string, projectId?: string) => { setDraft({ ...draftDefaults(), ...seedRelation(customerId, projectId) }); setModal('communication'); };
  const openFollowup = (customerId?: string, projectId?: string) => { setDraft({ ...draftDefaults(), ...seedRelation(customerId, projectId) }); setModal('followup'); };
  const openStatus = (customer: Customer) => { setDraft({ ...draftDefaults(), customerId: customer.id, status: effectiveStatus(customer) }); setModal('status'); };
  const openInvoice = (projectId?: string) => {
    const id = projectId || selectedProjectId || data.projects[0]?.id || '';
    setDraft({ ...draftDefaults(), projectId: id, amount: String(projectAuthorized(id) || ''), invoiceNumber: '' });
    setModal('invoice');
  };
  const openPayment = (invoiceId?: string) => {
    const invoice = invoiceId ? invoiceMap.get(invoiceId) : data.invoices.find((item) => invoiceBalance(item) > 0 && (!selectedProjectId || item.project_id === selectedProjectId));
    if (!invoice) { flash('No unpaid CRM invoice is available for this project.'); return; }
    setDraft({ ...draftDefaults(), invoiceId: invoice.id, projectId: invoice.project_id, amount: String(invoiceBalance(invoice)) });
    setModal('payment');
  };

  const submitModal = async (event: FormEvent) => {
    event.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError('');
    try {
      if (modal === 'communication') {
        if (!draft.customerId || !draft.summary.trim()) throw new Error('Client and communication summary are required.');
        const { error: communicationError } = await supabase.from('crm_communications').insert({
          customer_id: draft.customerId,
          contact_id: draft.contactId || null,
          project_id: draft.projectId || null,
          communication_type: draft.communicationType,
          direction: draft.direction,
          communication_date: draft.date,
          subject: draft.subject.trim(),
          summary: draft.summary.trim(),
        });
        if (communicationError) throw communicationError;
        if (draft.createFollowUp && draft.followUpTitle.trim()) {
          const { error: followupError } = await supabase.from('crm_followups').insert({
            customer_id: draft.customerId,
            contact_id: draft.contactId || null,
            project_id: draft.projectId || null,
            title: draft.followUpTitle.trim(),
            due_date: draft.followUpDate,
          });
          if (followupError) throw new Error(`Communication saved, but follow-up could not be created: ${followupError.message}`);
        }
        flash(draft.createFollowUp ? 'Communication and follow-up saved.' : 'Communication saved.');
      }
      if (modal === 'followup') {
        if (!draft.customerId || !draft.followUpTitle.trim()) throw new Error('Client and follow-up action are required.');
        const { error: followupError } = await supabase.from('crm_followups').insert({ customer_id: draft.customerId, contact_id: draft.contactId || null, project_id: draft.projectId || null, title: draft.followUpTitle.trim(), due_date: draft.followUpDate });
        if (followupError) throw followupError;
        flash('Follow-up saved.');
      }
      if (modal === 'status') {
        if (!draft.customerId) throw new Error('Client is required.');
        const { error: statusError } = await supabase.from('customers').update({ crm_status: draft.status }).eq('id', draft.customerId);
        if (statusError) throw statusError;
        flash('Relationship status updated.');
      }
      if (modal === 'invoice') {
        const amount = Number(draft.amount);
        if (!draft.projectId || !draft.invoiceNumber.trim() || !Number.isFinite(amount) || amount < 0) throw new Error('Project, invoice number, and valid amount are required.');
        const { error: invoiceError } = await supabase.from('crm_invoices').insert({ project_id: draft.projectId, invoice_number: draft.invoiceNumber.trim(), amount, issued_date: draft.issuedDate, due_date: draft.dueDate, notes: draft.notes.trim() });
        if (invoiceError) throw invoiceError;
        flash('Invoice recorded.');
      }
      if (modal === 'payment') {
        const amount = Number(draft.amount);
        if (!draft.invoiceId || !Number.isFinite(amount) || amount <= 0) throw new Error('Invoice and valid payment amount are required.');
        const { error: paymentError } = await supabase.from('crm_payments').insert({ invoice_id: draft.invoiceId, amount, payment_date: draft.date, reference: draft.reference.trim() });
        if (paymentError) throw paymentError;
        flash('Payment recorded.');
      }
      setModal(null);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save CRM record.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFollowup = async (item: FollowUp) => {
    setError('');
    const completed_at = item.completed_at ? null : new Date().toISOString();
    const { error: updateError } = await supabase.from('crm_followups').update({ completed_at }).eq('id', item.id);
    if (updateError) { setError(updateError.message); return; }
    flash(completed_at ? 'Follow-up completed.' : 'Follow-up reopened.');
    await loadData();
  };

  if (loading) return <div className={styles.loading}><img src="/brand/scopelogic-logo-full.png" alt="ScopeLogic" /><p>Loading Client CRM…</p></div>;

  const selectedCustomerProjects = selectedCustomer ? customerProjects(selectedCustomer.id) : [];
  const selectedCustomerContacts = selectedCustomer ? customerContacts(selectedCustomer.id) : [];
  const selectedCustomerCommunications = selectedCustomer ? data.communications.filter((item) => item.customer_id === selectedCustomer.id) : [];
  const selectedCustomerFollowups = selectedCustomer ? openFollowups.filter((item) => item.customer_id === selectedCustomer.id) : [];

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <a href="/" className={styles.brand}><img src="/brand/scopelogic-logo-full.png" alt="ScopeLogic" /></a>
      <div className={styles.moduleTag}>CLIENT CRM</div>
      <nav className={styles.nav}>
        <button className={view === 'dashboard' ? styles.active : ''} onClick={() => setView('dashboard')}>Relationship Dashboard</button>
        <button className={view === 'clients' ? styles.active : ''} onClick={() => setView('clients')}>Clients & Contacts</button>
        <button className={view === 'communications' ? styles.active : ''} onClick={() => setView('communications')}>Communications</button>
        <button className={view === 'projects' ? styles.active : ''} onClick={() => setView('projects')}>Projects & Billing</button>
        <button className={view === 'followups' ? styles.active : ''} onClick={() => setView('followups')}>Follow-Ups</button>
      </nav>
      <div className={styles.sidebarFoot}><span>ACCOUNT</span><b title={userEmail}>{userEmail}</b><a href="/">← Back to ScopeLogic</a></div>
    </aside>

    <main className={styles.main}>
      <header className={styles.topbar}>
        <div><span>ScopeLogic Client Relationships</span><h1>{view === 'dashboard' ? 'Relationship Dashboard' : view === 'clients' ? 'Clients & Contacts' : view === 'communications' ? 'Communication Audit Trail' : view === 'projects' ? 'Projects & Billing' : 'Follow-Ups'}</h1></div>
        <div className={styles.actions}><button className={styles.primary} onClick={() => openCommunication()}>+ Log Communication</button><button onClick={() => openFollowup()}>+ Follow-Up</button><button onClick={() => void loadData()}>Refresh</button></div>
      </header>
      <div className={styles.sourceBanner}>Customers, contacts, projects, and contract values come from the existing ScopeLogic workspace. CRM adds relationship history, follow-ups, invoices, payments, and receivables without duplicating those records.</div>
      {error && <div className={styles.error}>{error}<button onClick={() => setError('')}>×</button></div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {view === 'dashboard' && <section>
        <div className={styles.metrics}>
          <Metric label="Follow-Ups Due" value={String(dueFollowups.length)} alert={dueFollowups.length > 0} />
          <Metric label="Active Clients" value={String(data.customers.filter((customer) => effectiveStatus(customer) === 'Active Client').length)} />
          <Metric label="Active Projects" value={String(activeProjects.length)} />
          <Metric label="Outstanding A/R" value={money(outstandingAR)} alert={outstandingAR > 0} />
          <Metric label="Dated Payments YTD" value={money(datedPaymentsYtd)} />
          <Metric label="All-Time Payments" value={money(allTimePayments)} />
        </div>
        <div className={styles.gridTwo}>
          <Panel title="Follow-Ups Due" action={<button onClick={() => setView('followups')}>View all</button>}>
            {!dueFollowups.length ? <Empty text="No follow-ups are due." /> : dueFollowups.slice(0, 7).map((item) => <FollowupRow key={item.id} item={item} customer={customerMap.get(item.customer_id)} project={item.project_id ? projectMap.get(item.project_id) : undefined} onToggle={() => void toggleFollowup(item)} />)}
          </Panel>
          <Panel title="Outstanding Receivables" action={<button onClick={() => setView('projects')}>Open billing</button>}>
            {!outstandingInvoices.length && legacyOnlyProjectBalance <= 0 ? <Empty text="No outstanding receivables." /> : <>
              {outstandingInvoices.slice(0, 6).map((invoice) => { const project = projectMap.get(invoice.project_id); return <div className={styles.activityRow} key={invoice.id}><div className={styles.activityIcon}>$</div><div><b>{invoice.invoice_number} · {money(invoiceBalance(invoice))}</b><p>{project?.name || 'Project'}</p><span>{invoice.due_date < today() ? 'OVERDUE · ' : ''}Due {invoice.due_date}</span></div></div>; })}
              {legacyOnlyProjectBalance > 0 && <div className={styles.legacyNote}>Plus {money(legacyOnlyProjectBalance)} outstanding from existing Contract Information records that do not yet have CRM invoices.</div>}
            </>}
          </Panel>
        </div>
        <div className={styles.gridTwo}>
          <Panel title="Recent Communications">
            {!data.communications.length ? <Empty text="No communications have been logged." /> : data.communications.slice(0, 8).map((item) => <CommunicationRow key={item.id} item={item} customer={customerMap.get(item.customer_id)} contact={item.contact_id ? contactMap.get(item.contact_id) : undefined} project={item.project_id ? projectMap.get(item.project_id) : undefined} />)}
          </Panel>
          <Panel title="Active Projects">
            {!activeProjects.length ? <Empty text="No active projects." /> : activeProjects.slice(0, 8).map((project) => <div className={styles.projectRow} key={project.id}><div><b>{project.name}</b><span>{customerMap.get(project.customer_id || '')?.company_name || project.client_name || 'Client'}</span></div><span className={styles.pill}>{project.status}</span><b>{money(projectBalance(project.id))} due</b></div>)}
          </Panel>
        </div>
      </section>}

      {view === 'clients' && <section>
        <div className={styles.toolbar}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, contact, email, city, status…" /><a href="/">Manage customers in ScopeLogic</a></div>
        <div className={styles.clientGrid}>
          <aside className={styles.clientList}>{filteredCustomers.map((customer) => <button key={customer.id} className={selectedCustomer?.id === customer.id ? styles.selected : ''} onClick={() => setSelectedCustomerId(customer.id)}><b>{customer.company_name}</b><span>{effectiveStatus(customer)}</span><small>{customer.city}{customer.state ? `, ${customer.state}` : ''}</small></button>)}{!filteredCustomers.length && <Empty text="No matching clients." />}</aside>
          <div className={styles.clientDetail}>{selectedCustomer ? <>
            <div className={styles.clientHead}><div><span>{effectiveStatus(selectedCustomer)}</span><h2>{selectedCustomer.company_name}</h2><p>{[selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(', ') || 'Location not entered'}</p></div><div className={styles.actions}><button onClick={() => openStatus(selectedCustomer)}>Relationship Status</button><button onClick={() => openCommunication(selectedCustomer.id)}>Log Communication</button><button onClick={() => openFollowup(selectedCustomer.id)}>Follow-Up</button></div></div>
            <div className={styles.detailCards}><Detail label="Lifetime Authorized Fees" value={money(selectedCustomerProjects.reduce((sum, project) => sum + projectAuthorized(project.id), 0))} /><Detail label="Payments Received" value={money(selectedCustomerProjects.reduce((sum, project) => sum + projectPaid(project.id), 0))} /><Detail label="Outstanding" value={money(selectedCustomerProjects.reduce((sum, project) => sum + projectBalance(project.id), 0))} /></div>
            {selectedCustomer.notes && <div className={styles.notes}>{selectedCustomer.notes}</div>}
            <Panel title="Contacts">
              {!selectedCustomerContacts.length ? <Empty text="No contacts saved in Customer Database." /> : <div className={styles.contactCards}>{selectedCustomerContacts.map((contact) => <div key={contact.id} className={styles.contactCard}><b>{contact.name}</b><span>{contact.title || 'Title not entered'}</span>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : <small>Email not entered</small>}<small>{contact.phone || 'Phone not entered'}</small></div>)}</div>}
            </Panel>
            <Panel title="Project History"><ProjectTable projects={selectedCustomerProjects} customerMap={customerMap} contractMap={contractMap} projectAuthorized={projectAuthorized} projectInvoiced={projectInvoiced} projectPaid={projectPaid} projectBalance={projectBalance} onOpen={(id) => { setSelectedProjectId(id); setView('projects'); }} /></Panel>
            <Panel title="Communication Audit Trail">
              {!selectedCustomerCommunications.length ? <Empty text="No communications logged for this client." /> : selectedCustomerCommunications.map((item) => <CommunicationRow key={item.id} item={item} customer={selectedCustomer} contact={item.contact_id ? contactMap.get(item.contact_id) : undefined} project={item.project_id ? projectMap.get(item.project_id) : undefined} />)}
            </Panel>
            <Panel title="Open Follow-Ups">
              {!selectedCustomerFollowups.length ? <Empty text="No open follow-ups." /> : selectedCustomerFollowups.map((item) => <FollowupRow key={item.id} item={item} customer={selectedCustomer} project={item.project_id ? projectMap.get(item.project_id) : undefined} onToggle={() => void toggleFollowup(item)} />)}
            </Panel>
          </> : <Empty text="Select a client." />}</div>
        </div>
      </section>}

      {view === 'communications' && <section>
        <div className={styles.sectionHead}><div><h2>Communication Audit Trail</h2><p>Record outreach, replies, calls, meetings, documents, texts, and internal relationship notes.</p></div><button className={styles.primary} onClick={() => openCommunication()}>+ Log Communication</button></div>
        <Panel title="All Communications">{!data.communications.length ? <Empty text="No communications logged." /> : data.communications.map((item) => <CommunicationRow key={item.id} item={item} customer={customerMap.get(item.customer_id)} contact={item.contact_id ? contactMap.get(item.contact_id) : undefined} project={item.project_id ? projectMap.get(item.project_id) : undefined} />)}</Panel>
      </section>}

      {view === 'projects' && <section>
        <div className={styles.sectionHead}><div><h2>Project History & Billing</h2><p>Existing ScopeLogic projects and contract values with CRM invoices, payments, and balances.</p></div>{selectedProject && <button className={styles.primary} onClick={() => openInvoice(selectedProject.id)}>+ Record Invoice</button>}</div>
        <Panel title="All Accessible Projects"><ProjectTable projects={data.projects} customerMap={customerMap} contractMap={contractMap} projectAuthorized={projectAuthorized} projectInvoiced={projectInvoiced} projectPaid={projectPaid} projectBalance={projectBalance} onOpen={setSelectedProjectId} /></Panel>
        {selectedProject && <>
          <div className={styles.clientHead}><div><span>{customerMap.get(selectedProject.customer_id || '')?.company_name || selectedProject.client_name || 'Client'} · {selectedProject.status}</span><h2>{selectedProject.name}</h2><p>{contractMap.get(selectedProject.id)?.contracted_service || 'Contracted service not entered'}</p></div><div className={styles.actions}><button onClick={() => openCommunication(selectedProject.customer_id || undefined, selectedProject.id)}>Log Communication</button><button onClick={() => openFollowup(selectedProject.customer_id || undefined, selectedProject.id)}>Follow-Up</button><button onClick={() => openInvoice(selectedProject.id)}>+ Invoice</button><button onClick={() => openPayment()}>+ Payment</button></div></div>
          <div className={styles.detailCards}><Detail label="Authorized Fee" value={money(projectAuthorized(selectedProject.id))} /><Detail label="Invoiced" value={money(projectInvoiced(selectedProject.id))} /><Detail label="Paid" value={money(projectPaid(selectedProject.id))} /><Detail label="Balance Due" value={money(projectBalance(selectedProject.id))} /></div>
          <Panel title="CRM Invoices & Payments">
            {!projectInvoices(selectedProject.id).length ? <div className={styles.emptyBilling}>No CRM invoices recorded yet. Existing Contract Information shows {money(parseMoney(contractMap.get(selectedProject.id)?.amount_invoiced))} invoiced and {money(parseMoney(contractMap.get(selectedProject.id)?.amount_paid))} paid.</div> : <div className={styles.tableWrap}><table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>{projectInvoices(selectedProject.id).map((invoice) => <tr key={invoice.id}><td><b>{invoice.invoice_number}</b></td><td>{invoice.issued_date}</td><td>{invoice.due_date}</td><td>{money(invoice.amount)}</td><td>{money(invoicePaid(invoice.id))}</td><td><b>{money(invoiceBalance(invoice))}</b></td><td>{invoiceBalance(invoice) > 0 && <button onClick={() => openPayment(invoice.id)}>Record Payment</button>}</td></tr>)}</tbody></table></div>}
          </Panel>
        </>}
      </section>}

      {view === 'followups' && <section>
        <div className={styles.sectionHead}><div><h2>Client Follow-Ups</h2><p>Prospect outreach, active-client check-ins, payment follow-ups, and past-client relationship touches.</p></div><button className={styles.primary} onClick={() => openFollowup()}>+ Follow-Up</button></div>
        <div className={styles.taskList}>{!openFollowups.length ? <Empty text="No open follow-ups." /> : openFollowups.map((item) => <FollowupRow key={item.id} item={item} customer={customerMap.get(item.customer_id)} project={item.project_id ? projectMap.get(item.project_id) : undefined} onToggle={() => void toggleFollowup(item)} />)}</div>
        <Panel title="Completed Follow-Ups">{!data.followups.some((item) => item.completed_at) ? <Empty text="No completed follow-ups yet." /> : data.followups.filter((item) => item.completed_at).map((item) => <FollowupRow key={item.id} item={item} customer={customerMap.get(item.customer_id)} project={item.project_id ? projectMap.get(item.project_id) : undefined} onToggle={() => void toggleFollowup(item)} />)}</Panel>
      </section>}

      <footer className={styles.footer}><span>ScopeLogic Client CRM · Persistent workspace data</span><a href="/">Back to ScopeLogic Workspace</a></footer>
    </main>

    {modal && <Modal title={modalTitle(modal)} wide={modal === 'communication'} onClose={closeModal}>
      <form onSubmit={(event) => void submitModal(event)} className={styles.modalForm}>
        {modal === 'communication' && <CommunicationForm draft={draft} data={data} update={updateDraft} />}
        {modal === 'followup' && <FollowupForm draft={draft} data={data} update={updateDraft} />}
        {modal === 'status' && <><div className={styles.modalSummary}>{customerMap.get(draft.customerId)?.company_name}</div><Field label="Relationship Status"><select value={draft.status} onChange={(event) => updateDraft('status', event.target.value as RelationshipStatus)}><option>Prospect</option><option>Active Client</option><option>Past Client</option><option>Dormant</option></select></Field></>}
        {modal === 'invoice' && <InvoiceForm draft={draft} data={data} update={updateDraft} />}
        {modal === 'payment' && <PaymentForm draft={draft} data={data} invoiceMap={invoiceMap} invoiceBalance={invoiceBalance} projectMap={projectMap} update={updateDraft} />}
        <div className={styles.modalActions}><button type="button" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>}
  </div>;
}

function modalTitle(kind: Exclude<ModalKind, null>) { return kind === 'communication' ? 'Log Communication' : kind === 'followup' ? 'Add Follow-Up' : kind === 'invoice' ? 'Record Invoice' : kind === 'payment' ? 'Record Payment' : 'Relationship Status'; }
function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) { return <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`${styles.modalCard} ${wide ? styles.modalWide : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><div><span>ScopeLogic CRM</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><div className={styles.modalBody}>{children}</div></section></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.field}><span>{label}</span>{children}</label>; }
function CustomerSelect({ data, value, onChange }: { data: CrmData; value: string; onChange: (value: string) => void }) { return <Field label="Client"><select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select client…</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company_name}</option>)}</select></Field>; }
function ContactSelect({ data, customerId, value, onChange }: { data: CrmData; customerId: string; value: string; onChange: (value: string) => void }) { return <Field label="Contact"><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">No specific contact</option>{data.contacts.filter((contact) => !customerId || contact.customer_id === customerId).map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.title ? ` · ${contact.title}` : ''}</option>)}</select></Field>; }
function ProjectSelect({ data, customerId, value, onChange, required = false }: { data: CrmData; customerId?: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <Field label="Project"><select required={required} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{required ? 'Select project…' : 'No project / general relationship'}</option>{data.projects.filter((project) => !customerId || project.customer_id === customerId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>; }

function CommunicationForm({ draft, data, update }: { draft: Draft; data: CrmData; update: <K extends keyof Draft>(key: K, value: Draft[K]) => void }) {
  return <>
    <div className={styles.formGrid}><CustomerSelect data={data} value={draft.customerId} onChange={(value) => { update('customerId', value); update('contactId', ''); update('projectId', ''); }} /><ContactSelect data={data} customerId={draft.customerId} value={draft.contactId} onChange={(value) => update('contactId', value)} /><ProjectSelect data={data} customerId={draft.customerId} value={draft.projectId} onChange={(value) => update('projectId', value)} /><Field label="Date"><input type="date" required value={draft.date} onChange={(event) => update('date', event.target.value)} /></Field><Field label="Type"><select value={draft.communicationType} onChange={(event) => update('communicationType', event.target.value as CommunicationType)}><option>Email</option><option>Call</option><option>Teams</option><option>Meeting</option><option>Text</option><option>Document</option><option>Note</option></select></Field><Field label="Direction"><select value={draft.direction} onChange={(event) => update('direction', event.target.value as Direction)}><option>Outgoing</option><option>Incoming</option><option>Internal</option></select></Field></div>
    <Field label="Subject / Short Title"><input value={draft.subject} onChange={(event) => update('subject', event.target.value)} /></Field>
    <Field label="Communication Summary"><textarea required rows={7} value={draft.summary} onChange={(event) => update('summary', event.target.value)} placeholder="What was discussed, sent, requested, decided, or promised?" /></Field>
    <label className={styles.checkRow}><input type="checkbox" checked={draft.createFollowUp} onChange={(event) => update('createFollowUp', event.target.checked)} /><span>Create a follow-up from this communication</span></label>
    {draft.createFollowUp && <div className={styles.formGrid}><Field label="Follow-Up Action"><input required value={draft.followUpTitle} onChange={(event) => update('followUpTitle', event.target.value)} /></Field><Field label="Follow-Up Date"><input type="date" required value={draft.followUpDate} onChange={(event) => update('followUpDate', event.target.value)} /></Field></div>}
  </>;
}
function FollowupForm({ draft, data, update }: { draft: Draft; data: CrmData; update: <K extends keyof Draft>(key: K, value: Draft[K]) => void }) { return <><div className={styles.formGrid}><CustomerSelect data={data} value={draft.customerId} onChange={(value) => { update('customerId', value); update('contactId', ''); update('projectId', ''); }} /><ContactSelect data={data} customerId={draft.customerId} value={draft.contactId} onChange={(value) => update('contactId', value)} /><ProjectSelect data={data} customerId={draft.customerId} value={draft.projectId} onChange={(value) => update('projectId', value)} /><Field label="Due Date"><input type="date" required value={draft.followUpDate} onChange={(event) => update('followUpDate', event.target.value)} /></Field></div><Field label="Follow-Up Action"><textarea required rows={4} value={draft.followUpTitle} onChange={(event) => update('followUpTitle', event.target.value)} /></Field></>; }
function InvoiceForm({ draft, data, update }: { draft: Draft; data: CrmData; update: <K extends keyof Draft>(key: K, value: Draft[K]) => void }) { return <><div className={styles.formGrid}><ProjectSelect data={data} value={draft.projectId} onChange={(value) => update('projectId', value)} required /><Field label="Invoice Number"><input required value={draft.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} placeholder="SL-1001" /></Field><Field label="Amount"><input type="number" min="0" step="0.01" required value={draft.amount} onChange={(event) => update('amount', event.target.value)} /></Field><Field label="Issued Date"><input type="date" required value={draft.issuedDate} onChange={(event) => update('issuedDate', event.target.value)} /></Field><Field label="Due Date"><input type="date" required value={draft.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></Field></div><Field label="Invoice Notes"><textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></Field></>; }
function PaymentForm({ draft, data, invoiceMap, invoiceBalance, projectMap, update }: { draft: Draft; data: CrmData; invoiceMap: Map<string, Invoice>; invoiceBalance: (invoice: Invoice) => number; projectMap: Map<string, Project>; update: <K extends keyof Draft>(key: K, value: Draft[K]) => void }) { return <div className={styles.formGrid}><Field label="Invoice"><select required value={draft.invoiceId} onChange={(event) => { const id = event.target.value; update('invoiceId', id); const invoice = invoiceMap.get(id); if (invoice) { update('projectId', invoice.project_id); update('amount', String(invoiceBalance(invoice))); } }}><option value="">Select invoice…</option>{data.invoices.filter((invoice) => invoiceBalance(invoice) > 0).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {projectMap.get(invoice.project_id)?.name || 'Project'} · {money(invoiceBalance(invoice))} due</option>)}</select></Field><Field label="Amount Received"><input type="number" min="0.01" step="0.01" required value={draft.amount} onChange={(event) => update('amount', event.target.value)} /></Field><Field label="Payment Date"><input type="date" required value={draft.date} onChange={(event) => update('date', event.target.value)} /></Field><Field label="Method / Reference"><input value={draft.reference} onChange={(event) => update('reference', event.target.value)} /></Field></div>; }

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) { return <div className={`${styles.metric} ${alert ? styles.metricAlert : ''}`}><span>{label}</span><b>{value}</b></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section className={styles.panel}><header><h2>{title}</h2>{action}</header><div>{children}</div></section>; }
function Empty({ text }: { text: string }) { return <div className={styles.empty}>{text}</div>; }
function CommunicationRow({ item, customer, contact, project }: { item: Communication; customer?: Customer; contact?: Contact; project?: Project }) { return <div className={styles.activityRow}><div className={styles.activityIcon}>{item.communication_type.slice(0, 1)}</div><div><b>{customer?.company_name || 'Client'}{contact ? ` · ${contact.name}` : ''}</b><p>{item.subject ? `${item.subject} — ` : ''}{item.summary}</p><span>{item.communication_date} · {item.communication_type} · {item.direction}{project ? ` · ${project.name}` : ''}</span></div></div>; }
function FollowupRow({ item, customer, project, onToggle }: { item: FollowUp; customer?: Customer; project?: Project; onToggle: () => void }) { const overdue = !item.completed_at && item.due_date < today(); const dueToday = !item.completed_at && item.due_date === today(); return <div className={`${styles.taskRow} ${overdue ? styles.overdue : ''}`}><button className={styles.taskCheck} onClick={onToggle}>{item.completed_at ? '✓' : ''}</button><div><b>{item.title}</b><span>{customer?.company_name || 'Client'}{project ? ` · ${project.name}` : ''}</span></div><small>{overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : ''}{item.due_date}</small></div>; }
function ProjectTable({ projects, customerMap, contractMap, projectAuthorized, projectInvoiced, projectPaid, projectBalance, onOpen }: { projects: Project[]; customerMap: Map<string, Customer>; contractMap: Map<string, Contract>; projectAuthorized: (id: string) => number; projectInvoiced: (id: string) => number; projectPaid: (id: string) => number; projectBalance: (id: string) => number; onOpen?: (id: string) => void }) { if (!projects.length) return <Empty text="No projects available." />; return <div className={styles.tableWrap}><table><thead><tr><th>Client</th><th>Project</th><th>Service</th><th>Status</th><th>Authorized</th><th>Invoiced</th><th>Paid</th><th>Balance</th>{onOpen && <th></th>}</tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td>{customerMap.get(project.customer_id || '')?.company_name || project.client_name || '—'}</td><td><b>{project.name}</b></td><td>{contractMap.get(project.id)?.contracted_service || '—'}</td><td>{project.status}</td><td>{money(projectAuthorized(project.id))}</td><td>{money(projectInvoiced(project.id))}</td><td>{money(projectPaid(project.id))}</td><td><b>{money(projectBalance(project.id))}</b></td>{onOpen && <td><button onClick={() => onOpen(project.id)}>Open</button></td>}</tr>)}</tbody></table></div>; }
