'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type MasterProject = {
  id: string;
  project_number: string;
  name: string;
  location: string;
  status: string;
  version_date: string | null;
  revision: string;
  systems: string[];
  notes: string;
  is_archived: boolean;
  updated_at: string;
};

type Engagement = {
  id: string;
  legacy_id: string;
  master_project_id: string | null;
  client_name: string;
  customer_id: string | null;
  status: string;
  engagement_label: string;
  engagement_type: string;
  is_quick_review: boolean;
};

type MasterDocument = {
  id: string;
  document_type: string;
  display_name: string;
  revision: string;
  issue_date: string | null;
  is_current: boolean;
  notes: string;
  original_filename: string;
};

type MasterFinding = {
  id: string;
  display_number: string;
  systems: string[];
  scope_item: string;
  scope_concern: string;
  rfi_question: string;
  reference: string;
  source_type: string;
};

type Props = { masterProjectId: string; actualUserId: string; workspaceOwnerId: string; role: string; userName: string };
type View = 'dashboard' | 'setup' | 'calendar' | 'documents' | 'notes' | 'internal' | 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'quotes' | 'quote-templates' | 'drawing-takeoff' | 'takeoff' | 'scope-work' | 'parts' | 'labor' | 'releases' | 'exports' | 'contract';

const SYSTEMS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const STATUSES = ['Planning', 'Document Review', 'Bidding', 'Under Review', 'Award Support', 'Construction', 'Complete', 'On Hold'];
const MASTER_VIEWS = new Set<View>(['dashboard','setup','calendar','documents','notes','internal']);
const ENGAGEMENT_VIEWS = new Set<View>(['sow','clarifications','rfi','checklist','quotes','drawing-takeoff','takeoff','scope-work','releases','exports','contract']);

function Popup({ title, message, error, close }: { title: string; message: string; error?: boolean; close: () => void }) {
  return <div className="popup-backdrop"><section className={`popup ${error ? 'error' : ''}`}><div className="mark">{error ? '!' : '✓'}</div><h3>{title}</h3><p>{message}</p><button autoFocus onClick={close}>OK</button></section></div>;
}

function NavGroup({ label, items, view, go }: { label: string; items: [View, string][]; view: View; go: (view: View) => void }) {
  return <div className="nav-group"><div className="nav-label">{label}</div>{items.map(([id, text]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => go(id)}>{text}</button>)}</div>;
}

export default function MasterWorkspaceClient({ masterProjectId, role, userName }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = role === 'administrator' || role === 'manager';
  const [master, setMaster] = useState<MasterProject | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [documents, setDocuments] = useState<MasterDocument[]>([]);
  const [findings, setFindings] = useState<MasterFinding[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [engagementId, setEngagementId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({ name: '', location: '', status: 'Planning', revision: 'Rev 0', versionDate: '', systems: [] as string[], notes: '' });

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    const [masterResult, engagementResult, documentResult, findingResult] = await Promise.all([
      supabase.from('master_projects').select('id,project_number,name,location,status,version_date,revision,systems,notes,is_archived,updated_at').eq('id', masterProjectId).maybeSingle(),
      supabase.from('projects').select('id,legacy_id,master_project_id,client_name,customer_id,status,engagement_label,engagement_type,is_quick_review').eq('master_project_id', masterProjectId).order('client_name'),
      supabase.from('master_project_documents').select('id,document_type,display_name,revision,issue_date,is_current,notes,original_filename').eq('master_project_id', masterProjectId).order('created_at'),
      supabase.from('master_project_findings').select('id,display_number,systems,scope_item,scope_concern,rfi_question,reference,source_type').eq('master_project_id', masterProjectId).order('sequence_number'),
    ]);
    setLoading(false);
    const firstError = masterResult.error || engagementResult.error || documentResult.error || findingResult.error;
    if (firstError) { setLoadError(firstError.message); return; }
    if (!masterResult.data) { setLoadError('This Master Project is not available to your account or no longer exists.'); return; }
    const nextMaster = { ...masterResult.data, systems: Array.isArray(masterResult.data.systems) ? masterResult.data.systems : [] } as MasterProject;
    setMaster(nextMaster);
    setForm({ name: nextMaster.name, location: nextMaster.location || '', status: nextMaster.status, revision: nextMaster.revision, versionDate: nextMaster.version_date || '', systems: nextMaster.systems, notes: nextMaster.notes || '' });
    const nextEngagements = (engagementResult.data || []) as Engagement[];
    setEngagements(nextEngagements);
    setDocuments((documentResult.data || []) as MasterDocument[]);
    setFindings((findingResult.data || []).map((row: any) => ({ ...row, systems: Array.isArray(row.systems) ? row.systems : [] })) as MasterFinding[]);
    if (!engagementId && nextEngagements.length) setEngagementId(nextEngagements[0].id);
  }, [engagementId, masterProjectId, supabase]);

  useEffect(() => { void load(); }, [load]);

  const selectedEngagement = engagements.find((item) => item.id === engagementId) || null;
  const requiresEngagement = ENGAGEMENT_VIEWS.has(view);

  const go = (next: View) => {
    if (ENGAGEMENT_VIEWS.has(next) && !engagements.length) {
      setActionError('This section requires a Client Engagement. Add at least one Client Engagement to this Master Project first.');
      return;
    }
    setView(next);
  };

  const toggleSystem = (system: string) => setForm((current) => ({ ...current, systems: current.systems.includes(system) ? current.systems.filter((item) => item !== system) : [...current.systems, system] }));

  const saveMaster = async () => {
    if (!master) return setActionError('The Master Project is not loaded.');
    if (!form.name.trim()) return setActionError('Project Name is required before Project Setup can be saved.');
    setBusy(true);
    const { error } = await supabase.from('master_projects').update({
      name: form.name.trim(), location: form.location.trim(), status: form.status,
      revision: form.revision.trim() || 'Rev 0', version_date: form.versionDate || null,
      systems: form.systems, notes: form.notes.trim(), updated_at: new Date().toISOString(),
    }).eq('id', master.id);
    setBusy(false);
    if (error) return setActionError(error.message);
    await load();
    setSuccess(`Master Project ${master.project_number} Project Setup was saved successfully.`);
  };

  if (loading && !master) return <main className="loading">Loading Master Project…</main>;
  if (loadError && !master) return <main className="loading error"><h2>Master Project unavailable</h2><p>{loadError}</p><a href="/project-library">Return to Project Library</a></main>;
  if (!master) return null;

  return <main className="workspace-shell">
    <aside className="sidebar">
      <div className="brand"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /><div><b>ScopeLogic</b><span>v1.0 RC5.7</span></div></div>
      <a className="project-switch" href="/project-library"><span>Current Master Project</span><b>{master.project_number}</b><strong>{master.name}</strong><small>Switch Master Projects</small></a>
      <NavGroup label="PROJECT" view={view} go={go} items={[["dashboard","Dashboard"],["setup","Project Setup"],["calendar","Calendar"],["documents","Project Documents"],["notes","Internal Notes"],["internal","ScopeLogic Internal Matrix"]]} />
      <NavGroup label="DELIVERABLES" view={view} go={go} items={[["sow","Recommended SOW Matrix"],["clarifications","Clarification Matrix"],["rfi","Formal RFI"],["checklist","Contractor Checklist"]]} />
      <NavGroup label="ESTIMATING" view={view} go={go} items={[["quotes","Quote Builder"],["quote-templates","Quote Templates"],["drawing-takeoff","Drawing Take Off"],["takeoff","Take Off Rules"],["scope-work","Scope of Work"],["parts","Parts Database"],["labor","Labor & Pricing"]]} />
      <NavGroup label="PROJECT CONTROL" view={view} go={go} items={[["releases","Official Releases"],["exports","Export Log"],["contract","Contract Information"]]} />
      {isAdmin ? <a className="admin-link" href="/master-projects">Manage Master Project</a> : null}
      <div className="account"><span>ACCOUNT</span><b>{userName}</b><form action="/auth/signout" method="post"><button type="submit">Sign Out</button></form></div>
    </aside>

    <section className="main">
      <header className="topbar">
        <div><div className="eyebrow">{master.project_number} · Master Project</div><h1>{master.name}</h1><p>{master.location || 'No location entered'} · {master.status}</p></div>
        {requiresEngagement ? <label className="engagement-select"><span>Client Engagement</span><select value={engagementId} onChange={(event) => setEngagementId(event.target.value)}>{engagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.client_name || 'Unnamed Client'} — {engagement.engagement_type}</option>)}</select></label> : <div className="master-badge">MASTER PROJECT DATA</div>}
      </header>

      {loadError ? <div className="inline-error">Refresh warning: {loadError}</div> : null}

      <div className="page">
        {view === 'dashboard' ? <Dashboard master={master} engagements={engagements} documents={documents} findings={findings} go={go} /> : null}
        {view === 'setup' ? <section className="card form-card"><div className="card-head"><div><span>Master Project</span><h2>Project Setup</h2><p>Changes here apply to the Master Project as a whole and are immediately shared by all Client Engagements.</p></div><b>{master.project_number}</b></div>
          <label>Project Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="two"><label>Location / Address<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div>
          <div className="two"><label>Document Version Date<input type="date" value={form.versionDate} onChange={(e) => setForm({ ...form, versionDate: e.target.value })} /></label><label>Revision<input value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} /></label></div>
          <label>ScopeLogic Systems</label><div className="checks">{SYSTEMS.map((system) => <label key={system}><input type="checkbox" checked={form.systems.includes(system)} onChange={() => toggleSystem(system)} />{system}</label>)}</div>
          <label>Master Project Notes<textarea rows={7} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="save-row"><button className="primary" disabled={busy} onClick={() => void saveMaster()}>{busy ? 'Saving…' : 'Save Project Setup'}</button></div>
        </section> : null}

        {view === 'documents' ? <section className="card"><div className="card-head"><div><span>Master Project</span><h2>Project Documents</h2><p>These documents are shared source material for every Client Engagement under {master.project_number}.</p></div></div>{documents.length ? <div className="simple-table"><div className="row head"><span>Document</span><span>Type</span><span>Revision</span><span>Date</span><span>Current</span></div>{documents.map((doc) => <div className="row" key={doc.id}><span><b>{doc.display_name}</b><small>{doc.original_filename}</small></span><span>{doc.document_type}</span><span>{doc.revision}</span><span>{doc.issue_date || '—'}</span><span>{doc.is_current ? 'Yes' : 'No'}</span></div>)}</div> : <Empty title="No Master Project documents yet" text="Project Documents will be stored once at the Master Project level rather than duplicated for each customer." />}</section> : null}

        {view === 'internal' ? <section className="card"><div className="card-head"><div><span>Master Project</span><h2>ScopeLogic Internal Matrix</h2><p>Shared scope findings belong here. All engagements reference the same current Master Project analysis.</p></div></div>{findings.length ? <div className="simple-table findings"><div className="row head"><span>SLR</span><span>Systems</span><span>Scope Item</span><span>Concern</span><span>Reference</span></div>{findings.map((finding) => <div className="row" key={finding.id}><span><b>{finding.display_number}</b></span><span>{finding.systems.join(', ')}</span><span>{finding.scope_item}</span><span>{finding.scope_concern || '—'}</span><span>{finding.reference || '—'}</span></div>)}</div> : <Empty title="No shared findings yet" text="New common drawing/specification findings will be created at the Master Project level." />}</section> : null}

        {view === 'notes' ? <section className="card"><div className="card-head"><div><span>Master Project</span><h2>Internal Notes</h2><p>Master-level internal notes remain common to the project. Customer-specific strategy belongs inside its Client Engagement.</p></div></div><textarea rows={18} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><div className="save-row"><button className="primary" disabled={busy} onClick={() => void saveMaster()}>{busy ? 'Saving…' : 'Save Internal Notes'}</button></div></section> : null}

        {view === 'calendar' ? <MasterPlaceholder title="Calendar" description="Project-wide dates and milestones will be stored against the Master Project. Client-specific meetings and deadlines can remain on the selected engagement when applicable." /> : null}

        {requiresEngagement ? <EngagementWorkspacePanel view={view} master={master} engagement={selectedEngagement} /> : null}
        {view === 'quote-templates' ? <GlobalPlaceholder title="Quote Templates" description="Quote templates are workspace-wide and are not tied to a specific Master Project or Client Engagement." /> : null}
        {view === 'parts' ? <GlobalPlaceholder title="Parts Database" description="The Parts Database remains universal across ScopeLogic users in the workspace." /> : null}
        {view === 'labor' ? <GlobalPlaceholder title="Labor & Pricing" description="Labor rates and shared estimating settings remain universal across the ScopeLogic workspace." /> : null}
      </div>
    </section>

    {success ? <Popup title="Action Completed" message={success} close={() => setSuccess('')} /> : null}
    {actionError ? <Popup title="Action Not Completed" message={actionError} error close={() => setActionError('')} /> : null}

    <style jsx>{`
      .workspace-shell{min-height:100vh;background:#f5f6f2;color:#232723;font-family:Arial,Helvetica,sans-serif;display:grid;grid-template-columns:260px 1fr}.sidebar{position:sticky;top:0;height:100vh;background:#20241f;color:#eef0e9;padding:15px 11px;box-sizing:border-box;overflow:auto}.brand{display:flex;align-items:center;gap:9px;padding:7px 9px 15px;border-bottom:1px solid #394038}.brand img{width:39px;height:39px;object-fit:contain}.brand b,.brand span{display:block}.brand span{font-size:10px;color:#aab2a6;margin-top:2px}.project-switch{display:block;margin:12px 3px;padding:11px;background:#2b302a;border:1px solid #424942;border-radius:9px;text-decoration:none;color:white}.project-switch span,.project-switch b,.project-switch strong,.project-switch small{display:block}.project-switch span,.project-switch small{font-size:10px;color:#aeb6aa}.project-switch b{color:#b5bd72;margin-top:4px;font-size:12px}.project-switch strong{font-size:13px;margin:2px 0 5px}.nav-group{margin:15px 0}.nav-label{font-size:9px;letter-spacing:.12em;color:#929b8f;font-weight:900;padding:0 8px 5px}.nav-group button{width:100%;border:0;background:transparent;color:#dfe4dc;text-align:left;padding:7px 9px;border-radius:6px;cursor:pointer;font-size:12px}.nav-group button:hover,.nav-group button.active{background:#59612b;color:white}.admin-link{display:block;color:#cbd190;font-size:11px;text-decoration:none;padding:9px;border-top:1px solid #394038}.account{margin-top:16px;border-top:1px solid #394038;padding:12px 8px}.account span,.account b{display:block}.account span{font-size:9px;color:#929b8f}.account b{font-size:11px;margin:5px 0 8px}.account button{border:0;border-radius:5px;padding:6px 8px;cursor:pointer}.main{min-width:0}.topbar{background:white;border-bottom:1px solid #dfe2da;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;gap:18px;position:sticky;top:0;z-index:20}.topbar h1{font-size:23px;margin:2px 0}.topbar p{margin:0;color:#6d746c;font-size:12px}.eyebrow{font-size:10px;color:#59612b;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.engagement-select{min-width:320px}.engagement-select span{display:block;font-size:10px;text-transform:uppercase;font-weight:900;color:#687067;margin-bottom:4px}.engagement-select select{width:100%;padding:9px;border:1px solid #cbd0c6;border-radius:7px;background:white}.master-badge{font-size:10px;font-weight:900;color:#59612b;background:#eef0e7;border-radius:999px;padding:8px 11px}.page{padding:22px;max-width:1500px;margin:0 auto}.card{background:white;border:1px solid #d9ddd3;border-radius:12px;padding:19px}.card-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:15px}.card-head span{font-size:10px;text-transform:uppercase;font-weight:900;color:#59612b}.card-head h2{margin:3px 0;font-size:22px}.card-head p{margin:0;color:#6c736b;line-height:1.45}.form-card>label,.card>label{display:block;font-size:11px;font-weight:800;margin:12px 0 5px}.card input,.card select,.card textarea{box-sizing:border-box;width:100%;border:1px solid #cbd0c6;border-radius:7px;padding:9px;font:inherit}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.two label{font-size:11px;font-weight:800;margin-top:8px}.checks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border:1px solid #e0e3dc;border-radius:8px;padding:10px}.checks label{display:flex;gap:7px;align-items:center;font-size:12px}.checks input{width:auto}.save-row{display:flex;justify-content:flex-end;margin-top:16px}.primary{border:0;border-radius:8px;background:#59612b;color:white;font-weight:900;padding:10px 14px;cursor:pointer}.primary:disabled{opacity:.55}.simple-table{border:1px solid #e0e3dc;border-radius:8px;overflow:auto}.simple-table .row{display:grid;grid-template-columns:2fr 1fr .7fr .8fr .5fr;gap:10px;padding:10px;border-bottom:1px solid #e8eae5;min-width:760px;font-size:12px}.simple-table.findings .row{grid-template-columns:.55fr 1fr 1.4fr 2fr 1fr;min-width:900px}.simple-table .row.head{background:#fafbf8;font-size:10px;text-transform:uppercase;color:#6c736b;font-weight:900}.simple-table .row:last-child{border-bottom:0}.simple-table b,.simple-table small{display:block}.simple-table small{color:#747b73;margin-top:3px}.inline-error{margin:14px 22px 0;background:#fff1ef;border:1px solid #dfbbb6;color:#7b302a;border-radius:8px;padding:9px 12px}.popup-backdrop{position:fixed;inset:0;background:rgba(20,23,20,.58);display:grid;place-items:center;z-index:9000}.popup{background:white;border-radius:13px;padding:24px;width:min(420px,90vw);text-align:center}.mark{width:44px;height:44px;margin:0 auto 10px;background:#59612b;color:white;border-radius:50%;display:grid;place-items:center;font-size:23px;font-weight:900}.popup.error .mark{background:#8a352d}.popup h3{margin:0 0 7px}.popup p{color:#626a61;line-height:1.45}.popup button{border:0;border-radius:7px;background:#59612b;color:white;font-weight:900;padding:9px 18px;cursor:pointer}.loading{min-height:100vh;display:grid;place-items:center;font-family:Arial;background:#f5f6f2}.loading.error{display:block;padding:50px}.loading a{color:#59612b}.placeholder{padding:35px;text-align:center;background:#fafbf8;border:1px dashed #cbd0c6;border-radius:10px}.placeholder h3{margin:0 0 6px}.placeholder p{color:#6c736b;max-width:760px;margin:0 auto;line-height:1.5}@media(max-width:900px){.workspace-shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.topbar{position:relative;display:block}.engagement-select{min-width:0;margin-top:10px}.two,.checks{grid-template-columns:1fr}.page{padding:12px}}
    `}</style>
  </main>;
}

function Dashboard({ master, engagements, documents, findings, go }: { master: MasterProject; engagements: Engagement[]; documents: MasterDocument[]; findings: MasterFinding[]; go: (view: View) => void }) {
  return <><section className="dash-metrics"><div><b>{engagements.length}</b><span>Client Engagements</span></div><div><b>{documents.length}</b><span>Project Documents</span></div><div><b>{findings.length}</b><span>Shared Findings</span></div><div><b>{master.systems.length}</b><span>ScopeLogic Systems</span></div></section><section className="card"><div className="card-head"><div><span>Master Project Workflow</span><h2>{master.project_number} — {master.name}</h2><p>Project-level work is maintained once. Deliverables and estimating use a selected Client Engagement without duplicating the common project baseline.</p></div></div><div className="workflow-grid"><button onClick={() => go('setup')}><b>Project Setup</b><span>Edit common project information</span></button><button onClick={() => go('documents')}><b>Project Documents</b><span>Shared drawings/specifications/addenda</span></button><button onClick={() => go('internal')}><b>Internal Matrix</b><span>Shared scope intelligence</span></button><button onClick={() => go('sow')}><b>Deliverables</b><span>Select Client Engagement</span></button><button onClick={() => go('quotes')}><b>Estimating</b><span>Select Client Engagement</span></button></div></section><style jsx>{`.dash-metrics{display:grid;grid-template-columns:repeat(4,1fr);background:white;border:1px solid #d9ddd3;border-radius:12px;margin-bottom:14px;overflow:hidden}.dash-metrics div{padding:17px;border-right:1px solid #e2e5de}.dash-metrics div:last-child{border:0}.dash-metrics b,.dash-metrics span{display:block}.dash-metrics b{font-size:24px}.dash-metrics span{font-size:10px;text-transform:uppercase;color:#6b726a;font-weight:800}.workflow-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.workflow-grid button{border:1px solid #d9ddd3;background:#fafbf8;border-radius:9px;padding:14px;text-align:left;cursor:pointer}.workflow-grid b,.workflow-grid span{display:block}.workflow-grid b{color:#59612b}.workflow-grid span{font-size:11px;color:#6d746c;margin-top:5px}@media(max-width:1000px){.workflow-grid{grid-template-columns:1fr 1fr}.dash-metrics{grid-template-columns:1fr 1fr}}`}</style></>;
}

function EngagementWorkspacePanel({ view, master, engagement }: { view: View; master: MasterProject; engagement: Engagement | null }) {
  if (!engagement) return <Empty title="Select a Client Engagement" text="This area is customer-specific and cannot be opened without an engagement." />;
  const titles: Partial<Record<View,string>> = { sow:'Recommended SOW Matrix',clarifications:'Clarification Matrix',rfi:'Formal RFI',checklist:'Contractor Response Checklist',quotes:'Quote Builder','drawing-takeoff':'Drawing Take Off',takeoff:'Take Off Rules','scope-work':'Scope of Work',releases:'Official Releases',exports:'Export Log',contract:'Contract Information' };
  return <section className="card"><div className="card-head"><div><span>Client Engagement · {engagement.engagement_type}</span><h2>{titles[view] || 'Client Engagement Workspace'}</h2><p><b>{engagement.client_name || 'Unnamed Client'}</b> under {master.project_number} — {master.name}</p></div></div><div className="engagement-boundary"><b>Engagement context selected</b><p>This section writes customer-specific work to this Client Engagement. Master Project setup, documents, and shared findings remain common and do not need to be copied or synchronized manually.</p><dl><div><dt>Client / GC</dt><dd>{engagement.client_name || 'Not entered'}</dd></div><div><dt>Service</dt><dd>{engagement.engagement_type}</dd></div><div><dt>Status</dt><dd>{engagement.status}</dd></div><div><dt>Engagement</dt><dd>{engagement.engagement_label}</dd></div></dl></div><div className="placeholder"><h3>RC5.7 engagement adapter in progress</h3><p>The existing RC5.6 tool for this section is being moved behind this selected engagement context so historical quote/release behavior remains intact while the Project section moves to the Master Project.</p></div><style jsx>{`.engagement-boundary{background:#f1f3eb;border-left:4px solid #59612b;padding:14px;margin-bottom:14px}.engagement-boundary p{color:#626a61}.engagement-boundary dl{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.engagement-boundary dl div{background:white;border:1px solid #dfe3da;border-radius:7px;padding:9px}.engagement-boundary dt{font-size:9px;text-transform:uppercase;color:#70776f;font-weight:900}.engagement-boundary dd{margin:4px 0 0;font-size:12px;font-weight:800}.placeholder{padding:35px;text-align:center;background:#fafbf8;border:1px dashed #cbd0c6;border-radius:10px}.placeholder h3{margin:0 0 6px}.placeholder p{color:#6c736b;max-width:760px;margin:0 auto;line-height:1.5}@media(max-width:900px){.engagement-boundary dl{grid-template-columns:1fr 1fr}}`}</style></section>;
}

function MasterPlaceholder({ title, description }: { title: string; description: string }) { return <section className="card"><div className="card-head"><div><span>Master Project</span><h2>{title}</h2><p>{description}</p></div></div><Empty title={`${title} migration in progress`} text="This section is being moved from the legacy engagement record to the Master Project data model." /></section>; }
function GlobalPlaceholder({ title, description }: { title: string; description: string }) { return <section className="card"><div className="card-head"><div><span>Workspace Library</span><h2>{title}</h2><p>{description}</p></div></div><Empty title={`${title} remains workspace-wide`} text="This library is shared rather than duplicated at the Master Project or Client Engagement level." /></section>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="placeholder"><h3>{title}</h3><p>{text}</p></div>; }
