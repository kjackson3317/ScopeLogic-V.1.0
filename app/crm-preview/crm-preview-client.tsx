'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './crm-preview.module.css';

type Stage = 'Lead' | 'Ready to Contact' | 'Contacted' | 'Responded' | 'Qualified' | 'Project Received' | 'SOW Sent' | 'Contract / Vendor Setup' | 'Won' | 'Lost / Dormant';
type Offering = 'Quick Review' | 'Large Project' | 'Both';
type View = 'dashboard' | 'companies' | 'pipeline' | 'tasks';

type Company = {
  id: string;
  name: string;
  type: 'GC' | 'CM' | 'Owner' | 'Other';
  status: 'Prospect' | 'Client' | 'Dormant';
  projectMix: Offering;
  website: string;
  city: string;
  state: string;
  notes: string;
  lastActivity: string;
  nextFollowUp: string;
};

type Contact = {
  id: string;
  companyId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  role: string;
  influence: 'Decision Maker' | 'Influencer' | 'User' | 'Unknown';
};

type Opportunity = {
  id: string;
  companyId: string;
  contactId: string;
  name: string;
  stage: Stage;
  offering: Offering;
  value: number;
  probability: number;
  expectedClose: string;
  source: string;
  lastActivity: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
};

type Activity = {
  id: string;
  companyId: string;
  contactId?: string;
  opportunityId?: string;
  type: 'Email' | 'Call' | 'Meeting' | 'Note' | 'Document';
  date: string;
  summary: string;
};

type Task = {
  id: string;
  companyId: string;
  opportunityId?: string;
  title: string;
  dueDate: string;
  priority: 'Normal' | 'High';
  status: 'Open' | 'Complete';
};

type CrmData = {
  companies: Company[];
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  tasks: Task[];
};

const stages: Stage[] = ['Lead', 'Ready to Contact', 'Contacted', 'Responded', 'Qualified', 'Project Received', 'SOW Sent', 'Contract / Vendor Setup', 'Won', 'Lost / Dormant'];
const storageKey = 'scopelogic-crm-preview-v1';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
const uid = () => crypto.randomUUID();

function seedData(): CrmData {
  return {
    companies: [
      { id: 'c1', name: 'Demo General Contractor', type: 'GC', status: 'Prospect', projectMix: 'Both', website: 'https://example.com', city: 'Atlanta', state: 'GA', notes: 'Demo record only. Replace with a real prospect during evaluation.', lastActivity: today(), nextFollowUp: addDays(7) },
      { id: 'c2', name: 'Demo Retail Builder', type: 'GC', status: 'Prospect', projectMix: 'Quick Review', website: '', city: 'Charlotte', state: 'NC', notes: 'High-volume tenant and retail work.', lastActivity: addDays(-3), nextFollowUp: addDays(4) },
      { id: 'c3', name: 'Demo Construction Manager', type: 'CM', status: 'Prospect', projectMix: 'Large Project', website: '', city: 'Nashville', state: 'TN', notes: 'Large preconstruction and technology advisory target.', lastActivity: addDays(-8), nextFollowUp: today() },
    ],
    contacts: [
      { id: 'ct1', companyId: 'c1', name: 'Alex Morgan', title: 'Preconstruction Manager', email: 'alex@example.com', phone: '', role: 'Preconstruction', influence: 'Decision Maker' },
      { id: 'ct2', companyId: 'c2', name: 'Jordan Lee', title: 'Senior Estimator', email: 'jordan@example.com', phone: '', role: 'Estimating', influence: 'Influencer' },
      { id: 'ct3', companyId: 'c3', name: 'Taylor Smith', title: 'Project Executive', email: 'taylor@example.com', phone: '', role: 'Operations', influence: 'Decision Maker' },
    ],
    opportunities: [
      { id: 'o1', companyId: 'c1', contactId: 'ct1', name: 'ScopeLogic Introduction', stage: 'Contacted', offering: 'Both', value: 3000, probability: 20, expectedClose: addDays(30), source: 'Direct outreach', lastActivity: today(), nextAction: 'Follow up on introduction email', nextActionDate: addDays(7), notes: 'Both single-page sales sheets sent.' },
      { id: 'o2', companyId: 'c2', contactId: 'ct2', name: 'Tenant Quick Review Pilot', stage: 'Qualified', offering: 'Quick Review', value: 450, probability: 60, expectedClose: addDays(10), source: 'Direct outreach', lastActivity: addDays(-2), nextAction: 'Ask for live bid package', nextActionDate: addDays(2), notes: 'Good fit for one-project trial.' },
      { id: 'o3', companyId: 'c3', contactId: 'ct3', name: 'Large Project Advisory', stage: 'Responded', offering: 'Large Project', value: 6500, probability: 35, expectedClose: addDays(45), source: 'Referral', lastActivity: addDays(-4), nextAction: 'Schedule Teams call', nextActionDate: today(), notes: '' },
    ],
    activities: [
      { id: 'a1', companyId: 'c1', contactId: 'ct1', opportunityId: 'o1', type: 'Email', date: today(), summary: 'Introductory ScopeLogic email sent with both one-page sales PDFs.' },
      { id: 'a2', companyId: 'c2', contactId: 'ct2', opportunityId: 'o2', type: 'Call', date: addDays(-2), summary: 'Discussed trying ScopeLogic on one small project.' },
      { id: 'a3', companyId: 'c3', contactId: 'ct3', opportunityId: 'o3', type: 'Email', date: addDays(-4), summary: 'Received interest in larger-project preconstruction support.' },
    ],
    tasks: [
      { id: 't1', companyId: 'c1', opportunityId: 'o1', title: 'Follow up on introductory email', dueDate: addDays(7), priority: 'Normal', status: 'Open' },
      { id: 't2', companyId: 'c2', opportunityId: 'o2', title: 'Request pilot bid package', dueDate: addDays(2), priority: 'High', status: 'Open' },
      { id: 't3', companyId: 'c3', opportunityId: 'o3', title: 'Schedule Teams call', dueDate: today(), priority: 'High', status: 'Open' },
    ],
  };
}

export default function CrmPreviewClient({ userEmail }: { userEmail: string }) {
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<CrmData>(() => seedData());
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('c1');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setData(JSON.parse(saved) as CrmData);
    } catch {
      // Preview data should never block the page if browser storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, hydrated]);

  const companyMap = useMemo(() => new Map(data.companies.map((company) => [company.id, company])), [data.companies]);
  const contactMap = useMemo(() => new Map(data.contacts.map((contact) => [contact.id, contact])), [data.contacts]);
  const selectedCompany = data.companies.find((company) => company.id === selectedCompanyId) || data.companies[0];
  const selectedContacts = data.contacts.filter((contact) => contact.companyId === selectedCompany?.id);
  const selectedOpportunities = data.opportunities.filter((opportunity) => opportunity.companyId === selectedCompany?.id);
  const selectedActivities = data.activities.filter((activity) => activity.companyId === selectedCompany?.id).sort((a, b) => b.date.localeCompare(a.date));

  const openOpportunities = data.opportunities.filter((item) => !['Won', 'Lost / Dormant'].includes(item.stage));
  const openPipeline = openOpportunities.reduce((sum, item) => sum + item.value, 0);
  const weightedPipeline = openOpportunities.reduce((sum, item) => sum + item.value * (item.probability / 100), 0);
  const dueTasks = data.tasks.filter((item) => item.status === 'Open' && item.dueDate <= today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcomingTasks = data.tasks.filter((item) => item.status === 'Open').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const wonValue = data.opportunities.filter((item) => item.stage === 'Won').reduce((sum, item) => sum + item.value, 0);

  const filteredCompanies = data.companies.filter((company) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    const contacts = data.contacts.filter((contact) => contact.companyId === company.id);
    return [company.name, company.city, company.state, company.projectMix, company.notes, ...contacts.flatMap((contact) => [contact.name, contact.title, contact.email])]
      .join(' ').toLowerCase().includes(needle);
  });

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const addCompany = () => {
    const name = window.prompt('Company name');
    if (!name?.trim()) return;
    const projectMix = (window.prompt('Project mix: Quick Review, Large Project, or Both', 'Both') || 'Both') as Offering;
    const company: Company = { id: uid(), name: name.trim(), type: 'GC', status: 'Prospect', projectMix: ['Quick Review', 'Large Project', 'Both'].includes(projectMix) ? projectMix : 'Both', website: '', city: '', state: '', notes: '', lastActivity: today(), nextFollowUp: addDays(7) };
    setData((current) => ({ ...current, companies: [...current.companies, company] }));
    setSelectedCompanyId(company.id);
    setView('companies');
    flash('Company added to browser-local CRM preview.');
  };

  const addContact = () => {
    if (!selectedCompany) return;
    const name = window.prompt(`Contact name for ${selectedCompany.name}`);
    if (!name?.trim()) return;
    const title = window.prompt('Title', 'Estimator') || '';
    const email = window.prompt('Email', '') || '';
    const contact: Contact = { id: uid(), companyId: selectedCompany.id, name: name.trim(), title, email, phone: '', role: title || 'Other', influence: 'Unknown' };
    setData((current) => ({ ...current, contacts: [...current.contacts, contact] }));
    flash('Contact added.');
  };

  const addOpportunity = (companyId = selectedCompany?.id) => {
    if (!companyId) return;
    const company = companyMap.get(companyId);
    const name = window.prompt(`Opportunity name for ${company?.name || 'company'}`, 'ScopeLogic Opportunity');
    if (!name?.trim()) return;
    const offering = (window.prompt('Offering: Quick Review, Large Project, or Both', company?.projectMix || 'Both') || 'Both') as Offering;
    const value = Number(window.prompt('Estimated value', offering === 'Quick Review' ? '450' : '3000') || '0');
    const companyContacts = data.contacts.filter((contact) => contact.companyId === companyId);
    const opportunity: Opportunity = {
      id: uid(), companyId, contactId: companyContacts[0]?.id || '', name: name.trim(), stage: 'Lead',
      offering: ['Quick Review', 'Large Project', 'Both'].includes(offering) ? offering : 'Both', value: Number.isFinite(value) ? value : 0,
      probability: 10, expectedClose: addDays(30), source: 'Direct outreach', lastActivity: today(), nextAction: 'Initial outreach', nextActionDate: addDays(1), notes: '',
    };
    setData((current) => ({ ...current, opportunities: [...current.opportunities, opportunity] }));
    setView('pipeline');
    flash('Opportunity added.');
  };

  const logActivity = (companyId = selectedCompany?.id, opportunityId?: string) => {
    if (!companyId) return;
    const type = (window.prompt('Activity type: Email, Call, Meeting, Note, or Document', 'Email') || 'Note') as Activity['type'];
    const summary = window.prompt('Activity summary');
    if (!summary?.trim()) return;
    const activity: Activity = { id: uid(), companyId, opportunityId, type: ['Email', 'Call', 'Meeting', 'Note', 'Document'].includes(type) ? type : 'Note', date: today(), summary: summary.trim() };
    setData((current) => ({
      ...current,
      activities: [activity, ...current.activities],
      companies: current.companies.map((company) => company.id === companyId ? { ...company, lastActivity: today() } : company),
      opportunities: current.opportunities.map((opportunity) => opportunity.id === opportunityId ? { ...opportunity, lastActivity: today() } : opportunity),
    }));
    flash('Activity logged.');
  };

  const addTask = (companyId = selectedCompany?.id, opportunityId?: string) => {
    if (!companyId) return;
    const title = window.prompt('Follow-up / task');
    if (!title?.trim()) return;
    const dueDate = window.prompt('Due date (YYYY-MM-DD)', addDays(7)) || addDays(7);
    const task: Task = { id: uid(), companyId, opportunityId, title: title.trim(), dueDate, priority: 'Normal', status: 'Open' };
    setData((current) => ({ ...current, tasks: [...current.tasks, task] }));
    flash('Follow-up task added.');
  };

  const updateStage = (id: string, stage: Stage) => {
    setData((current) => ({ ...current, opportunities: current.opportunities.map((item) => item.id === id ? { ...item, stage, probability: stage === 'Won' ? 100 : item.probability } : item) }));
  };

  const completeTask = (id: string) => {
    setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, status: item.status === 'Open' ? 'Complete' : 'Open' } : item) }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ScopeLogic-CRM-Preview-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    flash('CRM preview exported as JSON.');
  };

  const resetDemo = () => {
    if (!window.confirm('Reset all browser-local CRM preview data to the demo records?')) return;
    const next = seedData();
    setData(next);
    setSelectedCompanyId(next.companies[0]?.id || '');
    flash('CRM preview reset.');
  };

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <a href="/" className={styles.brand}><img src="/brand/scopelogic-logo-full.png" alt="ScopeLogic" /></a>
      <div className={styles.previewTag}>CRM MVP · PREVIEW ONLY</div>
      <nav className={styles.nav}>
        <button className={view === 'dashboard' ? styles.active : ''} onClick={() => setView('dashboard')}>Sales Dashboard</button>
        <button className={view === 'companies' ? styles.active : ''} onClick={() => setView('companies')}>Companies & Contacts</button>
        <button className={view === 'pipeline' ? styles.active : ''} onClick={() => setView('pipeline')}>Pipeline</button>
        <button className={view === 'tasks' ? styles.active : ''} onClick={() => setView('tasks')}>Follow-Ups</button>
      </nav>
      <div className={styles.sidebarFoot}>
        <span>Signed in</span>
        <b title={userEmail}>{userEmail}</b>
        <a href="/">← Back to ScopeLogic</a>
      </div>
    </aside>

    <main className={styles.main}>
      <header className={styles.topbar}>
        <div><span>ScopeLogic Sales</span><h1>{view === 'dashboard' ? 'CRM Dashboard' : view === 'companies' ? 'Companies & Contacts' : view === 'pipeline' ? 'Opportunity Pipeline' : 'Follow-Ups & Tasks'}</h1></div>
        <div className={styles.actions}>
          <button onClick={addCompany}>+ Company</button>
          <button onClick={() => addOpportunity()}>+ Opportunity</button>
          <button onClick={exportJson}>Export JSON</button>
        </div>
      </header>

      <div className={styles.previewBanner}><b>No production impact.</b> This branch stores CRM preview data only in this browser. The proposed Supabase migration exists in source control but is not applied.</div>
      {notice && <div className={styles.notice}>{notice}</div>}

      {view === 'dashboard' && <section>
        <div className={styles.metrics}>
          <Metric label="Active Prospects" value={String(data.companies.filter((item) => item.status === 'Prospect').length)} />
          <Metric label="Open Opportunities" value={String(openOpportunities.length)} />
          <Metric label="Open Pipeline" value={money(openPipeline)} />
          <Metric label="Weighted Pipeline" value={money(weightedPipeline)} />
          <Metric label="Follow-Ups Due" value={String(dueTasks.length)} alert={dueTasks.length > 0} />
          <Metric label="Won" value={money(wonValue)} />
        </div>
        <div className={styles.gridTwo}>
          <Panel title="Follow-Ups Due" action={<button onClick={() => setView('tasks')}>View all</button>}>
            {!dueTasks.length ? <Empty text="Nothing due today." /> : dueTasks.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} company={companyMap.get(task.companyId)} onToggle={() => completeTask(task.id)} />)}
          </Panel>
          <Panel title="Recent Activity">
            {data.activities.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((activity) => <div key={activity.id} className={styles.activityRow}><div className={styles.activityIcon}>{activity.type.slice(0, 1)}</div><div><b>{companyMap.get(activity.companyId)?.name || 'Company'}</b><p>{activity.summary}</p><span>{activity.type} · {activity.date}</span></div></div>)}
          </Panel>
        </div>
        <Panel title="Current Pipeline" action={<button onClick={() => setView('pipeline')}>Open pipeline</button>}>
          <div className={styles.tableWrap}><table><thead><tr><th>Company</th><th>Opportunity</th><th>Offering</th><th>Stage</th><th>Value</th><th>Next Action</th><th>Date</th></tr></thead><tbody>{openOpportunities.map((item) => <tr key={item.id}><td>{companyMap.get(item.companyId)?.name}</td><td><b>{item.name}</b></td><td>{item.offering}</td><td><StagePill stage={item.stage} /></td><td>{money(item.value)}</td><td>{item.nextAction}</td><td>{item.nextActionDate}</td></tr>)}</tbody></table></div>
        </Panel>
      </section>}

      {view === 'companies' && <section>
        <div className={styles.companyToolbar}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, contact, email, city..." /><button onClick={addCompany}>+ New Company</button></div>
        <div className={styles.companyGrid}>
          <aside className={styles.companyList}>{filteredCompanies.map((company) => <button key={company.id} className={selectedCompany?.id === company.id ? styles.companySelected : ''} onClick={() => setSelectedCompanyId(company.id)}><b>{company.name}</b><span>{company.type} · {company.projectMix}</span><small>{company.city}{company.state ? `, ${company.state}` : ''}</small></button>)}{!filteredCompanies.length && <Empty text="No matching companies." />}</aside>
          <div className={styles.companyDetail}>{selectedCompany ? <>
            <div className={styles.companyHead}><div><span>{selectedCompany.type} · {selectedCompany.status}</span><h2>{selectedCompany.name}</h2><p>{selectedCompany.city}{selectedCompany.state ? `, ${selectedCompany.state}` : ''} · Project mix: <b>{selectedCompany.projectMix}</b></p></div><div className={styles.actions}><button onClick={addContact}>+ Contact</button><button onClick={() => addOpportunity(selectedCompany.id)}>+ Opportunity</button><button onClick={() => logActivity(selectedCompany.id)}>Log Activity</button><button onClick={() => addTask(selectedCompany.id)}>Follow-Up</button></div></div>
            <div className={styles.detailCards}><div><span>Last Activity</span><b>{selectedCompany.lastActivity || '—'}</b></div><div><span>Next Follow-Up</span><b>{selectedCompany.nextFollowUp || '—'}</b></div><div><span>Open Opportunities</span><b>{selectedOpportunities.filter((item) => !['Won', 'Lost / Dormant'].includes(item.stage)).length}</b></div></div>
            <div className={styles.notes}>{selectedCompany.notes || 'No company notes yet.'}</div>
            <Panel title="Contacts" action={<button onClick={addContact}>+ Contact</button>}>
              {!selectedContacts.length ? <Empty text="No contacts saved." /> : <div className={styles.contactCards}>{selectedContacts.map((contact) => <div key={contact.id} className={styles.contactCard}><b>{contact.name}</b><span>{contact.title || 'Title not entered'}</span><a href={contact.email ? `mailto:${contact.email}` : undefined}>{contact.email || 'Email not entered'}</a><small>{contact.influence}</small></div>)}</div>}
            </Panel>
            <Panel title="Opportunities">
              {!selectedOpportunities.length ? <Empty text="No opportunities for this company." /> : selectedOpportunities.map((opportunity) => <div className={styles.opportunityRow} key={opportunity.id}><div><b>{opportunity.name}</b><span>{opportunity.offering} · {money(opportunity.value)}</span></div><StagePill stage={opportunity.stage} /><button onClick={() => logActivity(opportunity.companyId, opportunity.id)}>Log</button></div>)}
            </Panel>
            <Panel title="Activity Timeline">
              {!selectedActivities.length ? <Empty text="No activity logged." /> : selectedActivities.map((activity) => <div key={activity.id} className={styles.timeline}><span>{activity.date}</span><div><b>{activity.type}</b><p>{activity.summary}</p></div></div>)}
            </Panel>
          </> : <Empty text="Select or add a company." />}</div>
        </div>
      </section>}

      {view === 'pipeline' && <section>
        <div className={styles.pipelineSummary}><span>{openOpportunities.length} open opportunities</span><b>{money(openPipeline)} pipeline</b><span>{money(weightedPipeline)} weighted</span></div>
        <div className={styles.pipelineBoard}>{stages.map((stage) => {
          const items = data.opportunities.filter((item) => item.stage === stage);
          return <div className={styles.stageColumn} key={stage}><div className={styles.stageHead}><b>{stage}</b><span>{items.length}</span></div>{items.map((item) => <article key={item.id} className={styles.opportunityCard}><small>{companyMap.get(item.companyId)?.name}</small><h3>{item.name}</h3><div className={styles.cardMeta}><span>{item.offering}</span><b>{money(item.value)}</b></div><p>{item.nextAction || 'No next action entered'}</p><span className={styles.cardDate}>{item.nextActionDate || 'No date'}</span><select value={item.stage} onChange={(event) => updateStage(item.id, event.target.value as Stage)}>{stages.map((option) => <option key={option} value={option}>{option}</option>)}</select><div className={styles.cardButtons}><button onClick={() => logActivity(item.companyId, item.id)}>Log</button><button onClick={() => addTask(item.companyId, item.id)}>Task</button></div></article>)}{!items.length && <div className={styles.stageEmpty}>No opportunities</div>}</div>;
        })}</div>
      </section>}

      {view === 'tasks' && <section>
        <div className={styles.taskHeader}><div><h2>Open Follow-Ups</h2><p>Keep the next action visible for every active opportunity.</p></div><button onClick={() => addTask()}>+ New Follow-Up</button></div>
        <div className={styles.taskList}>{upcomingTasks.map((task) => <TaskRow key={task.id} task={task} company={companyMap.get(task.companyId)} onToggle={() => completeTask(task.id)} />)}{!upcomingTasks.length && <Empty text="No open follow-ups." />}</div>
        <Panel title="Completed">
          {data.tasks.filter((item) => item.status === 'Complete').map((task) => <TaskRow key={task.id} task={task} company={companyMap.get(task.companyId)} onToggle={() => completeTask(task.id)} />)}
        </Panel>
      </section>}

      <footer className={styles.footer}><button onClick={resetDemo}>Reset demo data</button><span>Browser-local prototype. No Supabase CRM tables are being read or written.</span></footer>
    </main>
  </div>;
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`${styles.metric} ${alert ? styles.metricAlert : ''}`}><span>{label}</span><b>{value}</b></div>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className={styles.panel}><header><h2>{title}</h2>{action}</header><div>{children}</div></section>;
}

function Empty({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}

function StagePill({ stage }: { stage: Stage }) {
  return <span className={styles.stagePill}>{stage}</span>;
}

function TaskRow({ task, company, onToggle }: { task: Task; company?: Company; onToggle: () => void }) {
  const overdue = task.status === 'Open' && task.dueDate < today();
  const dueToday = task.status === 'Open' && task.dueDate === today();
  return <div className={`${styles.taskRow} ${overdue ? styles.overdue : ''}`}><button className={styles.taskCheck} onClick={onToggle}>{task.status === 'Complete' ? '✓' : ''}</button><div><b>{task.title}</b><span>{company?.name || 'Company'}</span></div><small>{overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : ''}{task.dueDate}</small>{task.priority === 'High' && <em>High</em>}</div>;
}
