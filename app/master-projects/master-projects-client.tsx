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
  is_archived: boolean;
  archived_at: string | null;
};

type Engagement = {
  id: string;
  master_project_id: string | null;
  legacy_id: string;
  name: string;
  client_name: string;
  customer_id: string | null;
  status: string;
  engagement_label: string;
  engagement_type: string;
  is_quick_review: boolean;
  assigned_user_id: string;
};

type WorkspaceUser = { id: string; email: string; full_name: string; role: string };
type Customer = {
  id: string;
  company_name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  website: string;
  notes: string;
};
type Props = { actualUserId: string; workspaceOwnerId: string; role: string; userName: string };

type MasterForm = { name: string; location: string; status: string; systems: string[]; notes: string };
type EngagementForm = { clientName: string; customerId: string; service: string; label: string; assignedUserId: string; systems: string[] };

const SYSTEMS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const SERVICES = ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Quick P1', 'Quick P2', 'Quick Bundle'];
const MASTER_STATUSES = ['Planning', 'Document Review', 'Bidding', 'Award Support', 'Construction', 'Complete', 'On Hold'];
const EMPTY_MASTER: MasterForm = { name: '', location: '', status: 'Planning', systems: [], notes: '' };
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const today = () => new Date().toISOString().slice(0, 10);

function Popup({ title, message, kind, onClose }: { title: string; message: string; kind: 'success' | 'error'; onClose: () => void }) {
  return <div className="mp-popup-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <section className={`mp-popup ${kind}`}>
      <div className="mp-popup-mark">{kind === 'success' ? '✓' : '!'}</div>
      <h3>{title}</h3>
      <p>{message}</p>
      <button className="mp-button" autoFocus onClick={onClose}>OK</button>
    </section>
  </div>;
}

function SystemSelector({ value, onChange, label = 'ScopeLogic Systems' }: { value: string[]; onChange: (next: string[]) => void; label?: string }) {
  const toggle = (system: string) => onChange(value.includes(system) ? value.filter((item) => item !== system) : [...value, system]);
  return <div className="mp-system-selector">
    <label>{label}</label>
    <details>
      <summary>{value.length ? `${value.length} system${value.length === 1 ? '' : 's'} selected` : 'Select systems'}</summary>
      <div className="mp-system-menu">
        {SYSTEMS.map((system) => <label key={system}><input type="checkbox" checked={value.includes(system)} onChange={() => toggle(system)} />{system}</label>)}
      </div>
    </details>
    {value.length ? <div className="mp-system-list compact">{value.map((system) => <span key={system}>{system}</span>)}</div> : null}
  </div>;
}

export default function MasterProjectsClient({ actualUserId, workspaceOwnerId, role, userName }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = role === 'administrator' || role === 'manager';
  const [masters, setMasters] = useState<MasterProject[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [projectSystems, setProjectSystems] = useState<Record<string, string[]>>({});
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [showNewMaster, setShowNewMaster] = useState(false);
  const [showEditMaster, setShowEditMaster] = useState(false);
  const [showNewEngagement, setShowNewEngagement] = useState(false);
  const [editingEngagement, setEditingEngagement] = useState<Engagement | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [masterForm, setMasterForm] = useState<MasterForm>(EMPTY_MASTER);
  const [engagementForm, setEngagementForm] = useState<EngagementForm>({ clientName: '', customerId: '', service: 'Product 1', label: 'Client Engagement', assignedUserId: actualUserId, systems: [] });
  const [customerForm, setCustomerForm] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    const [masterResult, engagementResult, systemResult, customerResult, userResult] = await Promise.all([
      supabase.from('master_projects').select('id,name,project_number,location,status,version_date,revision,systems,notes,created_by_user_id,is_archived,archived_at').order('project_number'),
      supabase.from('projects').select('id,master_project_id,legacy_id,name,client_name,customer_id,status,engagement_label,engagement_type,is_quick_review,assigned_user_id').order('name'),
      supabase.from('project_systems').select('project_id,system_name'),
      supabase.from('customers').select('id,company_name,address1,address2,city,state,postal_code,website,notes').order('company_name'),
      supabase.from('profiles').select('id,email,full_name,role').order('full_name'),
    ]);
    const firstError = masterResult.error || engagementResult.error || systemResult.error || customerResult.error || userResult.error;
    if (firstError) { setLoadError(firstError.message); return; }

    const nextMasters = (masterResult.data || []).map((row: any) => ({ ...row, systems: Array.isArray(row.systems) ? row.systems : [] })) as MasterProject[];
    const nextSystems: Record<string, string[]> = {};
    for (const row of systemResult.data || []) {
      const projectId = String((row as any).project_id);
      nextSystems[projectId] = [...(nextSystems[projectId] || []), String((row as any).system_name)];
    }
    setMasters(nextMasters);
    setEngagements((engagementResult.data || []) as Engagement[]);
    setProjectSystems(nextSystems);
    setCustomers((customerResult.data || []) as Customer[]);
    const visibleUsers = (userResult.data || []) as WorkspaceUser[];
    setUsers(visibleUsers.length ? visibleUsers : [{ id: actualUserId, email: '', full_name: userName, role }]);
  }, [actualUserId, role, supabase, userName]);

  useEffect(() => { void load(); }, [load]);

  const visibleMasters = masters.filter((master) => master.is_archived === showArchived);
  useEffect(() => {
    if (selectedId && visibleMasters.some((master) => master.id === selectedId)) return;
    setSelectedId(visibleMasters[0]?.id || '');
  }, [showArchived, masters, selectedId]);

  const selected = masters.find((master) => master.id === selectedId) || null;
  const selectedEngagements = engagements.filter((engagement) => engagement.master_project_id === selectedId);
  const unlinked = engagements.filter((engagement) => !engagement.master_project_id);

  const fail = (message: string) => { setBusy(false); setActionError(message); };
  const complete = async (message: string) => { setBusy(false); await load(); setSuccess(message); };

  const openNewMaster = () => { setMasterForm(EMPTY_MASTER); setShowNewMaster(true); };
  const openEditMaster = () => {
    if (!selected) return;
    setMasterForm({ name: selected.name, location: selected.location, status: selected.status, systems: selected.systems, notes: selected.notes });
    setShowEditMaster(true);
  };

  const createMaster = async () => {
    const name = masterForm.name.trim();
    if (!name) return fail('Master Project name is required before the project can be created.');
    setBusy(true);
    const { data, error } = await supabase.from('master_projects').insert({
      owner_id: workspaceOwnerId,
      created_by_user_id: actualUserId,
      legacy_id: makeId('master'),
      name,
      location: masterForm.location.trim(),
      status: masterForm.status,
      version_date: today(),
      revision: 'Rev 0',
      systems: masterForm.systems,
      notes: masterForm.notes.trim(),
    }).select('id,project_number').single();
    if (error || !data?.id) return fail(error?.message || 'The Master Project could not be created.');
    setSelectedId(String(data.id));
    setShowNewMaster(false);
    await complete(`Master Project ${data.project_number || ''} created successfully.`);
  };

  const saveMaster = async () => {
    if (!selected) return fail('No Master Project is selected.');
    if (!masterForm.name.trim()) return fail('Master Project name is required before changes can be saved.');
    setBusy(true);
    const { error } = await supabase.from('master_projects').update({
      name: masterForm.name.trim(),
      location: masterForm.location.trim(),
      status: masterForm.status,
      systems: masterForm.systems,
      notes: masterForm.notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    if (error) return fail(error.message);
    setShowEditMaster(false);
    await complete(`Master Project ${selected.project_number} updated successfully.`);
  };

  const archiveMaster = async () => {
    if (!selected) return fail('No Master Project is selected.');
    if (!window.confirm(`Archive ${selected.project_number} - ${selected.name}?`)) return;
    setBusy(true);
    const { error } = await supabase.from('master_projects').update({ is_archived: true, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) return fail(error.message);
    setSelectedId('');
    await complete(`Master Project ${selected.project_number} archived successfully.`);
  };

  const restoreMaster = async () => {
    if (!selected) return fail('No Master Project is selected.');
    setBusy(true);
    const { error } = await supabase.from('master_projects').update({ is_archived: false, archived_at: null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) return fail(error.message);
    setSelectedId('');
    await complete(`Master Project ${selected.project_number} restored successfully.`);
  };

  const deleteMaster = async () => {
    if (!selected) return fail('No Master Project is selected.');
    if (selectedEngagements.length) return fail('This Master Project cannot be deleted because it still has Client Engagements. Archive the Master Project instead, or remove/reassign its Client Engagements first.');
    if (!window.confirm(`Permanently delete ${selected.project_number} - ${selected.name}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from('master_projects').delete().eq('id', selected.id);
    if (error) return fail(error.message);
    setSelectedId('');
    await complete(`Master Project ${selected.project_number} deleted successfully.`);
  };

  const openNewEngagement = () => {
    if (!selected) return fail('Select a Master Project before adding a Client Engagement.');
    setEngagementForm({ clientName: '', customerId: '', service: 'Product 1', label: 'Client Engagement', assignedUserId: actualUserId, systems: [...selected.systems] });
    setShowNewEngagement(true);
  };

  const createEngagement = async () => {
    if (!selected) return fail('Select a Master Project before creating a Client Engagement.');
    const customer = customers.find((item) => item.id === engagementForm.customerId);
    const clientName = (customer?.company_name || engagementForm.clientName).trim();
    if (!clientName) return fail('Client / GC name is required before the Client Engagement can be created.');
    if (!engagementForm.systems.length) return fail('Select at least one ScopeLogic system for the Client Engagement.');
    const assignedUserId = isAdmin ? engagementForm.assignedUserId : actualUserId;
    setBusy(true);
    const { data, error } = await supabase.from('projects').insert({
      owner_id: workspaceOwnerId,
      assigned_user_id: assignedUserId,
      legacy_id: makeId('eng'),
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
    if (error || !data?.id) return fail(error?.message || 'The Client Engagement could not be created.');

    const systemRows = engagementForm.systems.map((system) => ({ owner_id: workspaceOwnerId, project_id: data.id, system_name: system }));
    const systemResult = await supabase.from('project_systems').insert(systemRows);
    if (systemResult.error) return fail(`The Client Engagement was created, but its systems could not be saved: ${systemResult.error.message}`);

    setShowNewEngagement(false);
    await complete('Client Engagement created successfully. It will also appear in the assigned user’s Project Library.');
  };

  const openEditEngagement = (engagement: Engagement) => {
    setEditingEngagement(engagement);
    setEngagementForm({
      clientName: engagement.client_name || '',
      customerId: engagement.customer_id || '',
      service: engagement.engagement_type || 'Product 1',
      label: engagement.engagement_label || 'Client Engagement',
      assignedUserId: engagement.assigned_user_id || actualUserId,
      systems: [...(projectSystems[engagement.id] || [])],
    });
  };

  const saveEngagement = async () => {
    if (!editingEngagement) return fail('No Client Engagement is selected for editing.');
    const customer = customers.find((item) => item.id === engagementForm.customerId);
    const clientName = (customer?.company_name || engagementForm.clientName).trim();
    if (!clientName) return fail('Client / GC name is required before changes can be saved.');
    if (!engagementForm.systems.length) return fail('Select at least one ScopeLogic system for the Client Engagement.');
    const assignedUserId = isAdmin ? engagementForm.assignedUserId : actualUserId;
    setBusy(true);
    const { error } = await supabase.from('projects').update({
      client_name: clientName,
      customer_id: engagementForm.customerId || null,
      engagement_label: engagementForm.label.trim() || 'Client Engagement',
      engagement_type: engagementForm.service,
      is_quick_review: engagementForm.service.startsWith('Quick'),
      assigned_user_id: assignedUserId,
      updated_at: new Date().toISOString(),
    }).eq('id', editingEngagement.id);
    if (error) return fail(error.message);

    const deleteResult = await supabase.from('project_systems').delete().eq('project_id', editingEngagement.id);
    if (deleteResult.error) return fail(`Client Engagement details saved, but systems could not be updated: ${deleteResult.error.message}`);
    const rows = engagementForm.systems.map((system) => ({ owner_id: workspaceOwnerId, project_id: editingEngagement.id, system_name: system }));
    const insertResult = await supabase.from('project_systems').insert(rows);
    if (insertResult.error) return fail(`Client Engagement details saved, but systems could not be updated: ${insertResult.error.message}`);

    setEditingEngagement(null);
    await complete('Client Engagement updated successfully.');
  };

  const openCustomerEditor = (engagement: Engagement) => {
    if (!engagement.customer_id) return fail('This Client Engagement is using a manually entered Client / GC name and is not linked to a Customer record. Link it to an existing customer first if you want to edit shared customer information.');
    const customer = customers.find((item) => item.id === engagement.customer_id);
    if (!customer) return fail('The linked Customer record could not be found.');
    setEditingCustomer(customer);
    setCustomerForm({ ...customer });
  };

  const saveCustomer = async () => {
    if (!editingCustomer || !customerForm) return fail('No Customer record is selected for editing.');
    if (!customerForm.company_name.trim()) return fail('Customer / GC company name is required before changes can be saved.');
    setBusy(true);
    const updates = {
      company_name: customerForm.company_name.trim(),
      address1: customerForm.address1.trim(),
      address2: customerForm.address2.trim(),
      city: customerForm.city.trim(),
      state: customerForm.state.trim(),
      postal_code: customerForm.postal_code.trim(),
      website: customerForm.website.trim(),
      notes: customerForm.notes.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('customers').update(updates).eq('id', editingCustomer.id);
    if (error) return fail(error.message);
    const projectUpdate = await supabase.from('projects').update({ client_name: updates.company_name, updated_at: new Date().toISOString() }).eq('customer_id', editingCustomer.id);
    if (projectUpdate.error) return fail(`Customer record saved, but linked project names could not be synchronized: ${projectUpdate.error.message}`);
    setEditingCustomer(null);
    setCustomerForm(null);
    await complete('Customer / GC information updated successfully across linked Client Engagements.');
  };

  const linkLegacyProject = async (engagement: Engagement) => {
    if (!isAdmin) return fail('Only an administrator can link legacy projects.');
    setBusy(true);
    const { data: master, error: masterError } = await supabase.from('master_projects').insert({
      owner_id: workspaceOwnerId,
      created_by_user_id: actualUserId,
      legacy_id: makeId('master'),
      name: engagement.name,
      status: engagement.status || 'Planning',
      version_date: today(),
      revision: 'Rev 0',
      systems: projectSystems[engagement.id] || [],
      notes: 'Created from an unlinked RC5.6 project.',
    }).select('id,project_number').single();
    if (masterError || !master?.id) return fail(masterError?.message || 'The Master Project could not be created.');
    const { error } = await supabase.from('projects').update({ master_project_id: master.id }).eq('id', engagement.id);
    if (error) return fail(error.message);
    setSelectedId(String(master.id));
    await complete(`Existing project linked to new Master Project ${master.project_number || ''} successfully.`);
  };

  return <main className="mp-page">
    <header className="mp-topbar">
      <div>
        <div className="mp-eyebrow">{isAdmin ? 'ScopeLogic RC5.7' : 'Project Workspace'}</div>
        <h1>Master Projects</h1>
        <p>Common project intelligence above private GC / CM Client Engagements.</p>
      </div>
      <div className="mp-actions">
        <a href="/" className="mp-button secondary">Project Workspace</a>
        <button className="mp-button" onClick={openNewMaster}>+ New Master Project</button>
      </div>
    </header>

    {loadError ? <div className="mp-message error">{loadError}</div> : null}

    <section className="mp-grid">
      <aside className="mp-sidebar">
        <div className="mp-sidebar-head">
          <div className="mp-sidebar-title">Master Project Library</div>
          <div className="mp-tabs"><button className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Active</button><button className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived</button></div>
        </div>
        {visibleMasters.length === 0 ? <div className="mp-empty">No {showArchived ? 'archived' : 'active'} Master Projects.</div> : visibleMasters.map((master) => {
          const count = engagements.filter((engagement) => engagement.master_project_id === master.id).length;
          return <button key={master.id} className={`mp-master-row ${master.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(master.id)}>
            <strong>{master.project_number} · {master.name}</strong>
            <span>{master.location || 'No location'}</span>
            <small>{count} Client Engagement{count === 1 ? '' : 's'}</small>
          </button>;
        })}
      </aside>

      <section className="mp-content">
        {!selected ? <div className="mp-panel"><h2>{showArchived ? 'No archived Master Project selected' : 'Create or select a Master Project'}</h2><p>A Master Project stores the shared issued-project baseline independently of any one GC / CM engagement.</p></div> : <>
          <div className="mp-hero">
            <div>
              <div className="mp-eyebrow">Master Project · {selected.project_number}</div>
              <h2>{selected.name}</h2>
              <p>{selected.location || 'Common project baseline'}</p>
            </div>
            <div className="mp-actions wrap">
              {!selected.is_archived ? <><button className="mp-button secondary" onClick={openEditMaster}>Edit Master</button><button className="mp-button" onClick={openNewEngagement}>+ Client Engagement</button><button className="mp-button secondary" disabled={busy} onClick={() => void archiveMaster()}>Archive</button></> : <button className="mp-button" disabled={busy} onClick={() => void restoreMaster()}>Restore</button>}
              {isAdmin ? <button className="mp-button danger" disabled={busy} onClick={() => void deleteMaster()}>Delete</button> : null}
            </div>
          </div>

          <div className="mp-summary">
            <div><span>Status</span><strong>{selected.status}</strong></div>
            <div><span>Systems</span><strong>{selected.systems.length}</strong></div>
            <div><span>Engagements</span><strong>{selectedEngagements.length}</strong></div>
            <div><span>Revision</span><strong>{selected.revision}</strong></div>
          </div>

          <div className="mp-panel">
            <div className="mp-panel-head"><div><h3>Common Project Baseline</h3><p className="mp-muted">Master-level information is the current shared source of truth for every Client Engagement under this project.</p></div>{!selected.is_archived ? <button className="mp-link-button" onClick={openEditMaster}>Edit shared details</button> : null}</div>
            <div className="mp-system-list">{selected.systems.map((system) => <span key={system}>{system}</span>)}</div>
            {selected.notes ? <p>{selected.notes}</p> : <p className="mp-muted">No common project notes entered.</p>}
            <div className="mp-boundary"><strong>Shared-information rule</strong><p>Documents, findings, clarifications, and technical facts intentionally stored at the Master Project level should update all Client Engagements. GC-specific bids, pricing, questions, recommendations, communications, and internal notes stay private to the individual Client Engagement. Engagement-only information does not automatically overwrite the Master Project.</p></div>
          </div>

          <div className="mp-panel">
            <div className="mp-panel-head"><div><h3>Client Engagements</h3><p>Edit each GC / CM, service, assigned user, and selected ScopeLogic systems directly from this Master Project screen.</p></div></div>
            {selectedEngagements.length === 0 ? <div className="mp-empty">No Client Engagements yet.</div> : <div className="mp-table-wrap"><table><thead><tr><th>Client / GC</th><th>Service</th><th>Systems</th><th>Assigned User</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {selectedEngagements.map((engagement) => {
                const assignee = users.find((user) => user.id === engagement.assigned_user_id);
                const systems = projectSystems[engagement.id] || [];
                return <tr key={engagement.id}>
                  <td><strong>{engagement.client_name || 'Unassigned client'}</strong><div>{engagement.engagement_label}</div></td>
                  <td>{engagement.engagement_type}{engagement.is_quick_review ? <span className="mp-chip">Quick</span> : null}</td>
                  <td>{systems.length ? systems.join(', ') : 'None selected'}</td>
                  <td>{assignee?.full_name || assignee?.email || (engagement.assigned_user_id === actualUserId ? userName : 'Assigned user')}</td>
                  <td>{engagement.status}</td>
                  <td><div className="mp-row-actions"><button onClick={() => openEditEngagement(engagement)}>Edit</button>{engagement.customer_id ? <button onClick={() => openCustomerEditor(engagement)}>Customer</button> : null}<a href="/">Open</a></div></td>
                </tr>;
              })}
            </tbody></table></div>}
          </div>
        </>}

        {isAdmin && unlinked.length ? <div className="mp-panel warning"><h3>Unlinked Legacy Projects</h3><p>These RC5.6 projects can be linked without changing their existing IDs or historical records.</p>{unlinked.map((item) => <div className="mp-unlinked" key={item.id}><span><strong>{item.name}</strong> — {item.client_name || 'No client'}</span><button onClick={() => void linkLegacyProject(item)} disabled={busy}>Create Master + Link</button></div>)}</div> : null}
      </section>
    </section>

    {showNewMaster ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><div><div className="mp-eyebrow">Auto-numbered on save</div><h2>New Master Project</h2></div><button onClick={() => setShowNewMaster(false)}>×</button></div>
      <label>Project Name<input value={masterForm.name} onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} /></label>
      <div className="mp-two"><label>Location / Address<input value={masterForm.location} onChange={(e) => setMasterForm({ ...masterForm, location: e.target.value })} /></label><label>Status<select value={masterForm.status} onChange={(e) => setMasterForm({ ...masterForm, status: e.target.value })}>{MASTER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div>
      <SystemSelector value={masterForm.systems} onChange={(systems) => setMasterForm({ ...masterForm, systems })} label="Master Project Systems" />
      <label>Common Project Notes<textarea rows={5} value={masterForm.notes} onChange={(e) => setMasterForm({ ...masterForm, notes: e.target.value })} /></label>
      <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => setShowNewMaster(false)}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void createMaster()}>{busy ? 'Saving…' : 'Create Master Project'}</button></div>
    </section></div> : null}

    {showEditMaster && selected ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><div><div className="mp-eyebrow">{selected.project_number}</div><h2>Edit Master Project</h2></div><button onClick={() => setShowEditMaster(false)}>×</button></div>
      <label>Project Name<input value={masterForm.name} onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} /></label>
      <div className="mp-two"><label>Location / Address<input value={masterForm.location} onChange={(e) => setMasterForm({ ...masterForm, location: e.target.value })} /></label><label>Status<select value={masterForm.status} onChange={(e) => setMasterForm({ ...masterForm, status: e.target.value })}>{MASTER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div>
      <SystemSelector value={masterForm.systems} onChange={(systems) => setMasterForm({ ...masterForm, systems })} label="Master Project Systems" />
      <label>Common Project Notes<textarea rows={5} value={masterForm.notes} onChange={(e) => setMasterForm({ ...masterForm, notes: e.target.value })} /></label>
      <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => setShowEditMaster(false)}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void saveMaster()}>{busy ? 'Saving…' : 'Save Master Project'}</button></div>
    </section></div> : null}

    {showNewEngagement && selected ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><div><div className="mp-eyebrow">{selected.project_number} · {selected.name}</div><h2>New Client Engagement</h2></div><button onClick={() => setShowNewEngagement(false)}>×</button></div>
      <label>Existing Customer / GC<select value={engagementForm.customerId} onChange={(e) => { const value = e.target.value; const customer = customers.find((item) => item.id === value); setEngagementForm({ ...engagementForm, customerId: value, clientName: customer?.company_name || engagementForm.clientName }); }}><option value="">Select or enter manually below</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company_name}</option>)}</select></label>
      <label>Client / GC Name<input value={engagementForm.clientName} onChange={(e) => setEngagementForm({ ...engagementForm, clientName: e.target.value, customerId: '' })} /></label>
      <div className="mp-two"><label>ScopeLogic Service<select value={engagementForm.service} onChange={(e) => setEngagementForm({ ...engagementForm, service: e.target.value })}>{SERVICES.map((service) => <option key={service}>{service}</option>)}</select></label><label>Engagement Label<input value={engagementForm.label} onChange={(e) => setEngagementForm({ ...engagementForm, label: e.target.value })} /></label></div>
      <SystemSelector value={engagementForm.systems} onChange={(systems) => setEngagementForm({ ...engagementForm, systems })} />
      {isAdmin ? <label>Assign to Project Library<select value={engagementForm.assignedUserId} onChange={(e) => setEngagementForm({ ...engagementForm, assignedUserId: e.target.value })}>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email || user.id} {user.role === 'administrator' ? '(Admin)' : ''}</option>)}</select></label> : null}
      <div className="mp-boundary"><strong>Shared baseline</strong><p>This engagement will use the current Master Project baseline. Only the systems selected above become part of this customer engagement. Private customer information remains isolated.</p></div>
      <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => setShowNewEngagement(false)}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void createEngagement()}>{busy ? 'Saving…' : 'Create Client Engagement'}</button></div>
    </section></div> : null}

    {editingEngagement ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><div><div className="mp-eyebrow">Client Engagement</div><h2>Edit {editingEngagement.client_name || 'Engagement'}</h2></div><button onClick={() => setEditingEngagement(null)}>×</button></div>
      <label>Existing Customer / GC<select value={engagementForm.customerId} onChange={(e) => { const value = e.target.value; const customer = customers.find((item) => item.id === value); setEngagementForm({ ...engagementForm, customerId: value, clientName: customer?.company_name || engagementForm.clientName }); }}><option value="">Manual client name</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company_name}</option>)}</select></label>
      <label>Client / GC Name<input value={engagementForm.clientName} onChange={(e) => setEngagementForm({ ...engagementForm, clientName: e.target.value, customerId: '' })} /></label>
      <div className="mp-two"><label>ScopeLogic Service<select value={engagementForm.service} onChange={(e) => setEngagementForm({ ...engagementForm, service: e.target.value })}>{SERVICES.map((service) => <option key={service}>{service}</option>)}</select></label><label>Engagement Label<input value={engagementForm.label} onChange={(e) => setEngagementForm({ ...engagementForm, label: e.target.value })} /></label></div>
      <SystemSelector value={engagementForm.systems} onChange={(systems) => setEngagementForm({ ...engagementForm, systems })} />
      {isAdmin ? <label>Assign to Project Library<select value={engagementForm.assignedUserId} onChange={(e) => setEngagementForm({ ...engagementForm, assignedUserId: e.target.value })}>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email || user.id}</option>)}</select></label> : null}
      <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => setEditingEngagement(null)}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void saveEngagement()}>{busy ? 'Saving…' : 'Save Client Engagement'}</button></div>
    </section></div> : null}

    {editingCustomer && customerForm ? <div className="mp-modal-backdrop"><section className="mp-modal"><div className="mp-modal-head"><div><div className="mp-eyebrow">Shared Customer Record</div><h2>Edit Customer / GC</h2></div><button onClick={() => { setEditingCustomer(null); setCustomerForm(null); }}>×</button></div>
      <label>Company Name<input value={customerForm.company_name} onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })} /></label>
      <label>Address 1<input value={customerForm.address1} onChange={(e) => setCustomerForm({ ...customerForm, address1: e.target.value })} /></label>
      <label>Address 2<input value={customerForm.address2} onChange={(e) => setCustomerForm({ ...customerForm, address2: e.target.value })} /></label>
      <div className="mp-three"><label>City<input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} /></label><label>State<input value={customerForm.state} onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })} /></label><label>Postal Code<input value={customerForm.postal_code} onChange={(e) => setCustomerForm({ ...customerForm, postal_code: e.target.value })} /></label></div>
      <label>Website<input value={customerForm.website} onChange={(e) => setCustomerForm({ ...customerForm, website: e.target.value })} /></label>
      <label>Customer Notes<textarea rows={4} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} /></label>
      <div className="mp-boundary"><strong>Shared customer record</strong><p>Changing the company name here updates linked Client Engagements that use this same Customer record.</p></div>
      <div className="mp-modal-actions"><button className="mp-button secondary" onClick={() => { setEditingCustomer(null); setCustomerForm(null); }}>Cancel</button><button className="mp-button" disabled={busy} onClick={() => void saveCustomer()}>{busy ? 'Saving…' : 'Save Customer'}</button></div>
    </section></div> : null}

    {success ? <Popup title="Action Completed" message={success} kind="success" onClose={() => setSuccess('')} /> : null}
    {actionError ? <Popup title="Action Not Completed" message={actionError} kind="error" onClose={() => setActionError('')} /> : null}

    <style jsx>{`
      .mp-page{min-height:100vh;background:#f5f6f2;color:#202420;font-family:Arial,Helvetica,sans-serif;padding:28px}.mp-topbar{max-width:1440px;margin:0 auto 20px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.mp-topbar h1{font-size:32px;margin:3px 0}.mp-topbar p,.mp-panel p{margin:4px 0;color:#687067}.mp-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#59612b}.mp-actions{display:flex;gap:10px}.mp-actions.wrap{flex-wrap:wrap;justify-content:flex-end}.mp-button{border:0;border-radius:8px;background:#59612b;color:white;font-weight:800;padding:11px 15px;cursor:pointer;text-decoration:none;font-size:14px}.mp-button.secondary{background:white;color:#272b27;border:1px solid #d9ddd3}.mp-button.danger{background:#8a352d}.mp-button:disabled{opacity:.55;cursor:not-allowed}.mp-message{max-width:1440px;margin:0 auto 16px;border-radius:8px;padding:11px 14px}.mp-message.error{background:#fff1ef;border:1px solid #e0b9b4;color:#762d27}.mp-grid{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:320px 1fr;gap:18px}.mp-sidebar,.mp-panel,.mp-hero,.mp-summary{background:white;border:1px solid #d9ddd3;border-radius:12px}.mp-sidebar{padding:12px;align-self:start}.mp-sidebar-title{font-weight:800;padding:8px}.mp-sidebar-head{display:grid;gap:7px;margin-bottom:8px}.mp-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px}.mp-tabs button{border:1px solid #d9ddd3;background:white;border-radius:7px;padding:7px;cursor:pointer;font-weight:700}.mp-tabs button.active{background:#59612b;color:white;border-color:#59612b}.mp-master-row{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:9px;background:transparent;padding:11px;margin-bottom:5px;cursor:pointer}.mp-master-row:hover,.mp-master-row.active{background:#f0f2ea;border-color:#ccd2c0}.mp-master-row strong,.mp-master-row span,.mp-master-row small{display:block}.mp-master-row span{font-size:12px;color:#687067;margin-top:4px}.mp-master-row small{font-size:11px;color:#59612b;margin-top:5px}.mp-content{min-width:0;display:grid;gap:14px}.mp-hero{padding:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}.mp-hero h2{font-size:26px;margin:2px 0}.mp-summary{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden}.mp-summary div{padding:14px 18px;border-right:1px solid #e1e4dc}.mp-summary div:last-child{border-right:0}.mp-summary span,.mp-summary strong{display:block}.mp-summary span{font-size:11px;color:#687067;text-transform:uppercase;font-weight:700}.mp-summary strong{font-size:16px;margin-top:4px}.mp-panel{padding:18px}.mp-panel h3{margin:0 0 6px}.mp-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mp-link-button{border:0;background:transparent;color:#59612b;font-weight:800;cursor:pointer}.mp-muted{max-width:1000px;line-height:1.5}.mp-system-list{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.mp-system-list.compact{margin:8px 0 0}.mp-system-list span,.mp-chip{font-size:11px;border-radius:999px;background:#eef0e7;color:#59612b;padding:5px 8px;font-weight:700}.mp-chip{margin-left:7px}.mp-table-wrap{overflow:auto;margin-top:12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e4e7df;padding:10px 8px;font-size:13px;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#687067}td div{font-size:11px;color:#687067;margin-top:3px}.mp-row-actions{display:flex!important;gap:6px!important;align-items:center}.mp-row-actions button,.mp-row-actions a{border:1px solid #ccd1c7;background:white;border-radius:6px;padding:5px 7px;color:#59612b;font-weight:700;text-decoration:none;cursor:pointer}.mp-empty{padding:16px;color:#687067}.warning{border-color:#d9c99d;background:#fffcf2}.mp-unlinked{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid #eadfbe;padding:9px 0}.mp-unlinked button{border:1px solid #b99b51;background:white;border-radius:7px;padding:7px 10px;cursor:pointer}.mp-modal-backdrop,.mp-popup-backdrop{position:fixed;inset:0;background:rgba(20,24,20,.55);display:grid;place-items:center;padding:20px;z-index:5000}.mp-modal{background:white;width:min(780px,96vw);max-height:92vh;overflow:auto;border-radius:14px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}.mp-modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}.mp-modal-head h2{margin:0}.mp-modal-head>button{border:0;background:transparent;font-size:28px;cursor:pointer}.mp-modal label,.mp-system-selector>label{display:block;font-size:12px;font-weight:800;margin:12px 0 5px}.mp-modal input,.mp-modal select,.mp-modal textarea{box-sizing:border-box;width:100%;border:1px solid #ccd1c7;border-radius:7px;padding:9px;font:inherit}.mp-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mp-three{display:grid;grid-template-columns:2fr .7fr 1fr;gap:12px}.mp-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.mp-boundary{background:#f2f3ee;border-left:4px solid #59612b;padding:11px 13px;margin-top:15px}.mp-boundary p{margin:5px 0 0;color:#555d54;line-height:1.45;font-size:13px}.mp-system-selector details{border:1px solid #ccd1c7;border-radius:7px;background:white;position:relative}.mp-system-selector summary{cursor:pointer;padding:10px;font-size:13px}.mp-system-menu{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;padding:8px 10px 12px;border-top:1px solid #e3e6de}.mp-system-menu label{font-weight:500;margin:0;display:flex;gap:7px;align-items:center}.mp-system-menu input{width:auto}.mp-popup-backdrop{z-index:6500}.mp-popup{width:min(420px,92vw);background:white;border-radius:14px;padding:24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.28)}.mp-popup-mark{width:46px;height:46px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;color:white;font-size:24px;font-weight:900}.mp-popup.success .mp-popup-mark{background:#59612b}.mp-popup.error .mp-popup-mark{background:#8a352d}.mp-popup h3{margin:0 0 8px;font-size:20px}.mp-popup p{margin:0 0 18px;color:#596159;line-height:1.45}@media(max-width:950px){.mp-page{padding:14px}.mp-topbar{display:block}.mp-actions{margin-top:12px}.mp-grid{grid-template-columns:1fr}.mp-summary{grid-template-columns:1fr 1fr}.mp-two,.mp-three,.mp-system-menu{grid-template-columns:1fr}.mp-hero{align-items:flex-start;flex-direction:column}}
    `}</style>
  </main>;
}
