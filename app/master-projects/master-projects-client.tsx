'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

type MasterProject = {
  id: string;
  name: string;
  project_number: string;
  location: string;
  status: string;
  version_date: string | null;
  revision: string;
  systems: string[];
  notes: string;
  created_by_user_id: string;
};

type Engagement = {
  id: string;
  master_project_id: string | null;
  legacy_id: string;
  name: string;
  client_name: string;
  status: string;
  engagement_label: string;
  engagement_type: string;
  is_quick_review: boolean;
  assigned_user_id: string;
};

type WorkspaceUser = { id: string; email: string; full_name: string; role: string };
type Customer = { id: string; name: string };
type Props = { actualUserId: string; workspaceOwnerId: string; role: string; userName: string };

const SYSTEMS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const SERVICES = ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Quick P1', 'Quick P2', 'Quick Bundle'];
const MASTER_STATUSES = ['Planning', 'Document Review', 'Bidding', 'Award Support', 'Construction', 'Complete', 'On Hold'];

const today = () => new Date().toISOString().slice(0, 10);
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export default function MasterProjectsClient({ actualUserId, workspaceOwnerId, role, userName }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = role === 'administrator' || role === 'manager';
  const [masters, setMasters] = useState<MasterProject[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNewMaster, setShowNewMaster] = useState(false);
  const [showNewEngagement, setShowNewEngagement] = useState(false);

  const [masterForm, setMasterForm] = useState({ name: '', projectNumber: '', location: '', status: 'Planning', systems: [] as string[], notes: '' });
  const [engagementForm, setEngagementForm] = useState({ clientName: '', customerId: '', service: 'Product 1', label: 'Client Engagement', assignedUserId: actualUserId });

  const load = useCallback(async () => {
    setMessage('');
    const [masterResult, engagementResult, customerResult, userResult] = await Promise.all([
      supabase.from('master_projects').select('id,name,project_number,location,status,version_date,revision,systems,notes,created_by_user_id').order('name'),
      supabase.from('projects').select('id,master_project_id,legacy_id,name,client_name,status,engagement_label,engagement_type,is_quick_review,assigned_user_id').order('name'),
      supabase.from('customers').select('id,name').order('name'),
      supabase.from('profiles').select('id,email,full_name,role').order('full_name'),
    ]);

    const firstError = masterResult.error || engagementResult.error || customerResult.error || userResult.error;
    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const nextMasters = (masterResult.data || []).map((row: any) => ({ ...row, systems: Array.isArray(row.systems) ? row.systems : [] })) as MasterProject[];
    setMasters(nextMasters);
    setEngagements((engagementResult.data || []) as Engagement[]);
    setCustomers((customerResult.data || []) as Customer[]);
    const visibleUsers = (userResult.data || []) as WorkspaceUser[];
    setUsers(visibleUsers.length ? visibleUsers : [{ id: actualUserId, email: '', full_name: userName, role }]);
    if (!selectedId && nextMasters.length) setSelectedId(nextMasters[0].id);
  }, [actualUserId, role, selectedId, supabase, userName]);

  useEffect(() => { void load(); }, [load]);

  const selected = masters.find((m) => m.id === selectedId) || null;
  const selectedEngagements = engagements.filter((e) => e.master_project_id === selectedId);
  const unlinked = engagements.filter((e) => !e.master_project_id);

  const toggleSystem = (system: string) => {
    setMasterForm((current) => ({
      ...current,
      systems: current.systems.includes(system) ? current.systems.filter((value) => value !== system) : [...current.systems, system],
    }));
  };

  const createMaster = async () => {
    const name = masterForm.name.trim();
    if (!name) { setMessage('Master Project name is required.'); return; }
    setBusy(true); setMessage('');
    const { data, error } = await supabase.from('master_projects').insert({
      owner_id: workspaceOwnerId,
      created_by_user_id: actualUserId,
      legacy_id: makeId('master'),
      name,
      project_number: masterForm.projectNumber.trim(),
      location: masterForm.location.trim(),
      status: masterForm.status,
      version_date: today(),
      revision: 'Rev 0',
      systems: masterForm.systems,
      notes: masterForm.notes.trim(),
    }).select('id').single();
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMasterForm({ name: '', projectNumber: '', location: '', status: 'Planning', systems: [], notes: '' });
    setShowNewMaster(false);
    if (data?.id) setSelectedId(String(data.id));
    setMessage('Master Project created. Add one or more Client Engagements beneath it.');
    await load();
  };

  const createEngagement = async () => {
    if (!selected) { setMessage('Select a Master Project first.'); return; }
    const customer = customers.find((item) => item.id === engagementForm.customerId);
    const clientName = (customer?.name || engagementForm.clientName).trim();
    if (!clientName) { setMessage('Client / GC name is required.'); return; }
    const assignedUserId = isAdmin ? engagementForm.assignedUserId : actualUserId;
    setBusy(true); setMessage('');
    const legacyId = makeId('eng');
    const { data, error } = await supabase.from('projects').insert({
      owner_id: workspaceOwnerId,
      assigned_user_id: assignedUserId,
      legacy_id: legacyId,
      master_project_id: selected.id,
      name: selected.name,
      client_name: clientName,
      customer_id: engagementForm.customerId || null,
      version_date: today(),
      status: 'Planning',
      revision: 'Rev 0',
      modified_label: 'Now',
      engagement_label: engagementForm.label.trim() || 'Client Engagement',
      engagement_type: engagementForm.service,
      is_quick_review: engagementForm.service.startsWith('Quick'),
    }).select('id').single();

    if (error || !data?.id) {
      setBusy(false); setMessage(error?.message || 'Could not create Client Engagement.'); return;
    }

    if (selected.systems.length) {
      const systemRows = selected.systems.map((system) => ({ owner_id: workspaceOwnerId, project_id: data.id, system_name: system }));
      const systemResult = await supabase.from('project_systems').insert(systemRows);
      if (systemResult.error) setMessage(`Engagement created, but systems could not be copied: ${systemResult.error.message}`);
    }

    setBusy(false);
    setEngagementForm({ clientName: '', customerId: '', service: 'Product 1', label: 'Client Engagement', assignedUserId: actualUserId });
    setShowNewEngagement(false);
    if (!message) setMessage('Client Engagement created. It will also appear in the normal Project Library.');
    await load();
  };

  const linkLegacyProject = async (engagement: Engagement) => {
    if (!isAdmin) return;
    setBusy(true); setMessage('');
    const { data: master, error: masterError } = await supabase.from('master_projects').insert({
      owner_id: workspaceOwnerId,
      created_by_user_id: actualUserId,
      legacy_id: makeId('master'),
      name: engagement.name,
      status: engagement.status || 'Planning',
      version_date: today(),
      revision: 'Rev 0',
      systems: [],
      notes: 'Created from an unlinked RC5.6 project.',
    }).select('id').single();
    if (masterError || !master?.id) { setBusy(false); setMessage(masterError?.message || 'Could not create Master Project.'); return; }
    const { error } = await supabase.from('projects').update({ master_project_id: master.id }).eq('id', engagement.id);
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setSelectedId(String(master.id));
    setMessage('Existing project linked to a new Master Project.');
    await load();
  };

  return (
    <main className="mp-page">
      <header className="mp-topbar">
        <div>
          <div className="mp-eyebrow">{isAdmin ? 'ScopeLogic RC5.7' : 'Project Workspace'}</div>
          <h1>Master Projects</h1>
          <p>Common project intelligence above private GC / CM Client Engagements.</p>
        </div>
        <div className="mp-actions">
          <a href="/" className="mp-button secondary">Project Workspace</a>
          <button className="mp-button" onClick={() => setShowNewMaster(true)}>+ New Master Project</button>
        </div>
      </header>

      {message ? <div className="mp-message">{message}</div> : null}

      <section className="mp-grid">
        <aside className="mp-sidebar">
          <div className="mp-sidebar-title">Master Project Library</div>
          {masters.length === 0 ? <div className="mp-empty">No Master Projects yet.</div> : masters.map((master) => {
            const count = engagements.filter((e) => e.master_project_id === master.id).length;
            return <button key={master.id} className={`mp-master-row ${master.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(master.id)}>
              <strong>{master.name}</strong>
              <span>{master.project_number || 'No project #'}</span>
              <small>{count} Client Engagement{count === 1 ? '' : 's'}</small>
            </button>;
          })}
        </aside>

        <section className="mp-content">
          {!selected ? (
            <div className="mp-panel"><h2>Create a Master Project</h2><p>A Master Project stores common issued-project context independently of any one GC / CM engagement.</p></div>
          ) : (
            <>
              <div className="mp-hero">
                <div>
                  <div className="mp-eyebrow">Master Project</div>
                  <h2>{selected.name}</h2>
                  <p>{[selected.project_number, selected.location].filter(Boolean).join(' • ') || 'Common project baseline'}</p>
                </div>
                <button className="mp-button" onClick={() => setShowNewEngagement(true)}>+ Client Engagement</button>
              </div>

              <div className="mp-summary">
                <div><span>Status</span><strong>{selected.status}</strong></div>
                <div><span>Systems</span><strong>{selected.systems.length || 0}</strong></div>
                <div><span>Engagements</span><strong>{selectedEngagements.length}</strong></div>
                <div><span>Revision</span><strong>{selected.revision}</strong></div>
              </div>

              <div className="mp-panel">
                <h3>Common Project Baseline</h3>
                <p className="mp-muted">Drawings, specifications, addenda, common scope findings, drawing/spec conflicts, responsibility ambiguities, and reusable technical risk belong at the Master Project level. GC-specific bids, pricing, communications, recommendations, and releases remain inside the Client Engagement.</p>
                <div className="mp-system-list">{selected.systems.map((system) => <span key={system}>{system}</span>)}</div>
                {selected.notes ? <p>{selected.notes}</p> : null}
              </div>

              <div className="mp-panel">
                <div className="mp-panel-head"><div><h3>Client Engagements</h3><p>Each row is a private GC / CM engagement under the shared project baseline.</p></div></div>
                {selectedEngagements.length === 0 ? <div className="mp-empty">No Client Engagements yet.</div> : (
                  <div className="mp-table-wrap"><table><thead><tr><th>Client / GC</th><th>Service</th><th>Assigned User</th><th>Status</th><th>Library</th></tr></thead><tbody>
                    {selectedEngagements.map((engagement) => {
                      const assignee = users.find((u) => u.id === engagement.assigned_user_id);
                      return <tr key={engagement.id}>
                        <td><strong>{engagement.client_name || 'Unassigned client'}</strong><div>{engagement.engagement_label}</div></td>
                        <td>{engagement.engagement_type}{engagement.is_quick_review ? <span className="mp-chip">Quick</span> : null}</td>
                        <td>{assignee?.full_name || assignee?.email || (engagement.assigned_user_id === actualUserId ? userName : 'Assigned user')}</td>
                        <td>{engagement.status}</td>
                        <td><a href="/">Open in Projects</a></td>
                      </tr>;
                    })}
                  </tbody></table></div>
                )}
              </div>
            </>
          )}

          {isAdmin && unlinked.length ? <div className="mp-panel warning"><h3>Unlinked Legacy Projects</h3><p>Projects created by the RC5.6 production UI during the RC5.7 preview can be linked safely without changing their IDs or historical records.</p>{unlinked.map((item) => <div className="mp-unlinked" key={item.id}><span><strong>{item.name}</strong> — {item.client_name || 'No client'}</span><button onClick={() => void linkLegacyProject(item)} disabled={busy}>Create Master + Link</button></div>)}</div> : null}
        </section>
      </section>

      {showNewMaster ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><h2>New Master Project</h2><button onClick={() => setShowNewMaster(false)}>×</button></div>
        <label>Project Name<input value={masterForm.name} onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} /></label>
        <div className="mp-two"><label>Project Number<input value={masterForm.projectNumber} onChange={(e) => setMasterForm({ ...masterForm, projectNumber: e.target.value })} /></label><label>Status<select value={masterForm.status} onChange={(e) => setMasterForm({ ...masterForm, status: e.target.value })}>{MASTER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <label>Location / Address<input value={masterForm.location} onChange={(e) => setMasterForm({ ...masterForm, location: e.target.value })} /></label>
        <label>Systems</label><div className="mp-checks">{SYSTEMS.map((s) => <label key={s}><input type="checkbox" checked={masterForm.systems.includes(s)} onChange={() => toggleSystem(s)} />{s}</label>)}</div>
        <label>Common Project Notes<textarea rows={4} value={masterForm.notes} onChange={(e) => setMasterForm({ ...masterForm, notes: e.target.value })} /></label>
        <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => setShowNewMaster(false)}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void createMaster()}>{busy ? 'Saving…' : 'Create Master Project'}</button></div>
      </section></div> : null}

      {showNewEngagement && selected ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><div><div className="mp-eyebrow">{selected.name}</div><h2>New Client Engagement</h2></div><button onClick={() => setShowNewEngagement(false)}>×</button></div>
        <label>Existing Customer / GC<select value={engagementForm.customerId} onChange={(e) => { const value = e.target.value; const customer = customers.find((item) => item.id === value); setEngagementForm({ ...engagementForm, customerId: value, clientName: customer?.name || engagementForm.clientName }); }}><option value="">Select or enter manually below</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label>Client / GC Name<input value={engagementForm.clientName} onChange={(e) => setEngagementForm({ ...engagementForm, clientName: e.target.value, customerId: '' })} /></label>
        <div className="mp-two"><label>ScopeLogic Service<select value={engagementForm.service} onChange={(e) => setEngagementForm({ ...engagementForm, service: e.target.value })}>{SERVICES.map((service) => <option key={service}>{service}</option>)}</select></label><label>Engagement Label<input value={engagementForm.label} onChange={(e) => setEngagementForm({ ...engagementForm, label: e.target.value })} /></label></div>
        {isAdmin ? <label>Assign to Project Library<select value={engagementForm.assignedUserId} onChange={(e) => setEngagementForm({ ...engagementForm, assignedUserId: e.target.value })}>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email || user.id} {user.role === 'administrator' ? '(Admin)' : ''}</option>)}</select></label> : null}
        <div className="mp-boundary"><strong>Confidentiality boundary</strong><p>Bidder identities, proposal pricing, GC-specific questions, recommendations, notes, communications, and releases stay in this Client Engagement. Only common issued-document analysis belongs in the Master Project.</p></div>
        <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => setShowNewEngagement(false)}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void createEngagement()}>{busy ? 'Saving…' : 'Create Client Engagement'}</button></div>
      </section></div> : null}

      <style jsx>{`
        .mp-page{min-height:100vh;background:#f5f6f2;color:#202420;font-family:Arial,Helvetica,sans-serif;padding:28px}.mp-topbar{max-width:1440px;margin:0 auto 20px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.mp-topbar h1{font-size:32px;margin:3px 0}.mp-topbar p,.mp-panel p{margin:4px 0;color:#687067}.mp-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#59612b}.mp-actions{display:flex;gap:10px}.mp-button{border:0;border-radius:8px;background:#59612b;color:white;font-weight:800;padding:11px 15px;cursor:pointer;text-decoration:none;font-size:14px}.mp-button.secondary{background:white;color:#272b27;border:1px solid #d9ddd3}.mp-message{max-width:1440px;margin:0 auto 16px;background:#eef0e7;border:1px solid #cfd5c3;border-radius:8px;padding:11px 14px}.mp-grid{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:300px 1fr;gap:18px}.mp-sidebar,.mp-panel,.mp-hero,.mp-summary{background:white;border:1px solid #d9ddd3;border-radius:12px}.mp-sidebar{padding:12px;align-self:start}.mp-sidebar-title{font-weight:800;padding:8px 8px 12px}.mp-master-row{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:9px;background:transparent;padding:11px;margin-bottom:5px;cursor:pointer}.mp-master-row:hover,.mp-master-row.active{background:#f0f2ea;border-color:#ccd2c0}.mp-master-row strong,.mp-master-row span,.mp-master-row small{display:block}.mp-master-row span{font-size:12px;color:#687067;margin-top:4px}.mp-master-row small{font-size:11px;color:#59612b;margin-top:5px}.mp-content{min-width:0;display:grid;gap:14px}.mp-hero{padding:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}.mp-hero h2{font-size:26px;margin:2px 0}.mp-summary{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden}.mp-summary div{padding:14px 18px;border-right:1px solid #e1e4dc}.mp-summary div:last-child{border-right:0}.mp-summary span,.mp-summary strong{display:block}.mp-summary span{font-size:11px;color:#687067;text-transform:uppercase;font-weight:700}.mp-summary strong{font-size:16px;margin-top:4px}.mp-panel{padding:18px}.mp-panel h3{margin:0 0 6px}.mp-muted{max-width:1000px;line-height:1.5}.mp-system-list{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.mp-system-list span,.mp-chip{font-size:11px;border-radius:999px;background:#eef0e7;color:#59612b;padding:5px 8px;font-weight:700}.mp-chip{margin-left:7px}.mp-table-wrap{overflow:auto;margin-top:12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e4e7df;padding:10px 8px;font-size:13px}th{font-size:11px;text-transform:uppercase;color:#687067}td div{font-size:11px;color:#687067;margin-top:3px}td a{color:#59612b;font-weight:700}.mp-empty{padding:16px;color:#687067}.warning{border-color:#d9c99d;background:#fffcf2}.mp-unlinked{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid #eadfbe;padding:9px 0}.mp-unlinked button{border:1px solid #b99b51;background:white;border-radius:7px;padding:7px 10px;cursor:pointer}.mp-modal-backdrop{position:fixed;inset:0;background:rgba(20,24,20,.55);display:grid;place-items:center;padding:20px;z-index:5000}.mp-modal{background:white;width:min(760px,96vw);max-height:92vh;overflow:auto;border-radius:14px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}.mp-modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}.mp-modal-head h2{margin:0}.mp-modal-head>button{border:0;background:transparent;font-size:28px;cursor:pointer}.mp-modal label{display:block;font-size:12px;font-weight:800;margin:12px 0 5px}.mp-modal input,.mp-modal select,.mp-modal textarea{box-sizing:border-box;width:100%;border:1px solid #ccd1c7;border-radius:7px;padding:9px;font:inherit}.mp-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mp-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.mp-checks label{font-weight:500;margin:0;display:flex;gap:7px;align-items:center}.mp-checks input{width:auto}.mp-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.mp-boundary{background:#f2f3ee;border-left:4px solid #59612b;padding:11px 13px;margin-top:15px}.mp-boundary p{margin:5px 0 0;color:#555d54;line-height:1.45;font-size:13px}@media(max-width:900px){.mp-page{padding:14px}.mp-topbar{display:block}.mp-actions{margin-top:12px}.mp-grid{grid-template-columns:1fr}.mp-summary{grid-template-columns:1fr 1fr}.mp-two,.mp-checks{grid-template-columns:1fr}.mp-hero{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  );
}
