from pathlib import Path
import re

path = Path('app/workspace.tsx')
text = path.read_text()
original = text

react_import = "import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';\n"
if "../lib/supabase/client" not in text:
    text = text.replace(react_import, react_import + "import { createClient } from '../lib/supabase/client';\n", 1)

project_tail = "  contract: ContractDetails;\n};\n\ntype ContractDetails"
master_types = """  contract: ContractDetails;
};

type MasterEngagementMeta = {
  id: string;
  legacyId: string;
  clientName: string;
  engagementType: string;
  engagementLabel: string;
};

type MasterProjectMeta = {
  id: string;
  projectNumber: string;
  name: string;
  location: string;
  status: string;
  revision: string;
  systems: string[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  engagements: MasterEngagementMeta[];
};

type ContractDetails"""
if project_tail in text:
    text = text.replace(project_tail, master_types, 1)

nav_anchor = """const navDeliverables: [View, string][] = [
  ['sow', 'Recommended SOW Matrix'],
  ['clarifications', 'Clarification Matrix'],
  ['rfi', 'Formal RFI'],
  ['checklist', 'Contractor Response Checklist'],
];
"""
nav_replacement = nav_anchor + "\nconst ENGAGEMENT_SPECIFIC_VIEWS = new Set<View>(['sow', 'clarifications', 'rfi', 'checklist', 'quotes', 'drawing-takeoff', 'takeoff', 'scope-work', 'releases', 'exports', 'contract']);\n"
if 'ENGAGEMENT_SPECIFIC_VIEWS' not in text:
    if nav_anchor not in text:
        raise SystemExit('Deliverable nav anchor not found')
    text = text.replace(nav_anchor, nav_replacement, 1)

workspace_anchor = """export default function Workspace({ userEmail }: { userEmail: string; userId: string }) {
  const [view, setView] = useState<View>('projects');
"""
workspace_replacement = """export default function Workspace({ userEmail }: { userEmail: string; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [masterProjects, setMasterProjects] = useState<MasterProjectMeta[]>([]);
  const [masterLoadError, setMasterLoadError] = useState('');
  const [view, setView] = useState<View>('projects');
"""
if workspace_anchor in text:
    text = text.replace(workspace_anchor, workspace_replacement, 1)
elif 'const [masterProjects, setMasterProjects]' not in text:
    raise SystemExit('Workspace anchor not found')

apply_anchor = "  const applySnapshot = (data: Partial<WorkspaceSnapshot> | null) => {\n"
master_loader = """  const refreshMasterProjects = useCallback(async () => {
    setMasterLoadError('');
    const [masterResult, engagementResult] = await Promise.all([
      supabase.from('master_projects').select('id,project_number,name,location,status,revision,systems,is_archived,created_at,updated_at').order('created_at', { ascending: false }),
      supabase.from('projects').select('id,legacy_id,master_project_id,client_name,engagement_type,engagement_label').not('master_project_id', 'is', null),
    ]);
    const firstError = masterResult.error || engagementResult.error;
    if (firstError) {
      setMasterLoadError(firstError.message);
      return;
    }
    const engagementRows = (engagementResult.data || []) as any[];
    const next = (masterResult.data || []).map((row: any): MasterProjectMeta => ({
      id: String(row.id),
      projectNumber: String(row.project_number || ''),
      name: String(row.name || ''),
      location: String(row.location || ''),
      status: row.is_archived ? 'Archived' : String(row.status || 'Planning'),
      revision: String(row.revision || 'Rev 0'),
      systems: Array.isArray(row.systems) ? row.systems.map(String) : [],
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || row.created_at || ''),
      isArchived: Boolean(row.is_archived),
      engagements: engagementRows.filter((item) => String(item.master_project_id || '') === String(row.id)).map((item): MasterEngagementMeta => ({
        id: String(item.id),
        legacyId: String(item.legacy_id || ''),
        clientName: String(item.client_name || ''),
        engagementType: String(item.engagement_type || 'Client Engagement'),
        engagementLabel: String(item.engagement_label || ''),
      })).filter((item) => Boolean(item.legacyId)),
    }));
    setMasterProjects(next);
  }, [supabase]);

"""
if 'const refreshMasterProjects = useCallback' not in text:
    if apply_anchor not in text:
        raise SystemExit('applySnapshot anchor not found')
    text = text.replace(apply_anchor, master_loader + apply_anchor, 1)

# Refresh Master metadata after the live workspace has hydrated. This does not replace
# or rewrite the live cloud workspace state.
hydration_effect_anchor = """  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('scopelogic-r14-8', JSON.stringify(cloudSnapshot));
  }, [hydrated, cloudSnapshot]);
"""
master_effects = hydration_effect_anchor + """

  useEffect(() => {
    if (!hydrated || dataMode !== 'cloud') return;
    void refreshMasterProjects();
  }, [hydrated, dataMode, refreshMasterProjects]);

  useEffect(() => {
    if (view === 'projects' && hydrated && dataMode === 'cloud') void refreshMasterProjects();
  }, [view, hydrated, dataMode, refreshMasterProjects]);
"""
if 'if (view === \'projects\' && hydrated' not in text:
    if hydration_effect_anchor not in text:
        raise SystemExit('Hydration effect anchor not found')
    text = text.replace(hydration_effect_anchor, master_effects, 1)

project_anchor = """  const project = projects.find((item) => item.id === projectId) || projects[0];
  const issues = issuesByProject[projectId] || [];
"""
project_replacement = """  const project = projects.find((item) => item.id === projectId) || projects[0];
  const currentMaster = masterProjects.find((master) => master.engagements.some((engagement) => engagement.legacyId === projectId)) || null;
  const activeMasterId = currentMaster?.id || '';
  const currentMasterEngagements = currentMaster?.engagements.filter((engagement) => projects.some((item) => item.id === engagement.legacyId)) || [];
  const isEngagementSpecificView = ENGAGEMENT_SPECIFIC_VIEWS.has(view);
  const issues = issuesByProject[projectId] || [];
"""
if project_anchor in text:
    text = text.replace(project_anchor, project_replacement, 1)
elif 'const currentMaster = masterProjects.find' not in text:
    raise SystemExit('Current project anchor not found')

retry_anchor = "  const retryCloudSync = async () => {\n"
open_master = """  const openMasterProject = (masterId: string) => {
    const master = masterProjects.find((item) => item.id === masterId);
    if (!master) return message('Master Project Unavailable', 'The selected Master Project could not be found.');
    const available = master.engagements.filter((engagement) => projects.some((item) => item.id === engagement.legacyId));
    if (!available.length) {
      message('Client Engagement Required', `${master.projectNumber} — ${master.name} does not have a Client Engagement yet. Add one in Master Project Management before opening the project workspace.`);
      return;
    }
    const nextProjectId = available.some((engagement) => engagement.legacyId === projectId) ? projectId : available[0].legacyId;
    setProjectId(nextProjectId);
    setSelectedUid('');
    setDraft(null);
    setPdfUrls({});
    setView('dashboard');
  };

  const openMasterProjectManager = () => { window.location.href = '/master-projects'; };

"""
if 'const openMasterProject = (masterId: string)' not in text:
    if retry_anchor not in text:
        raise SystemExit('Retry cloud sync anchor not found')
    text = text.replace(retry_anchor, open_master + retry_anchor, 1)

old_switch = "        <button className=\"project-switch\" onClick={() => navigateTo('projects')}><span>Current project</span><b>{project.name}</b><small>Switch projects</small></button>"
new_switch = "        <button className=\"project-switch\" onClick={() => navigateTo('projects')}><span>Current master project</span><b>{currentMaster?.name || project.name}</b><small>Switch master projects</small></button>"
if old_switch in text:
    text = text.replace(old_switch, new_switch, 1)

old_topbar = "          <div className=\"topbar-project\"><span>{project.client || 'ScopeLogic project'}</span><b>{project.name}</b></div>"
new_topbar = """          <div className="topbar-project"><span>{currentMaster?.projectNumber || project.client || 'ScopeLogic project'}</span><b>{currentMaster?.name || project.name}</b></div>
          {isEngagementSpecificView && currentMasterEngagements.length > 1 && <div className="topbar-project"><span>Client Engagement</span><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedUid(''); setDraft(null); setPdfUrls({}); }} style={{ maxWidth: 260, padding: '5px 7px', border: '1px solid #d6d9d1', borderRadius: 6, background: '#fff' }}>{currentMasterEngagements.map((engagement) => <option key={engagement.id} value={engagement.legacyId}>{engagement.clientName || 'Unnamed Client'} — {engagement.engagementLabel || engagement.engagementType}</option>)}</select></div>}"""
if old_topbar in text:
    text = text.replace(old_topbar, new_topbar, 1)

old_library_call = "          {view === 'projects' && <ProjectLibrary projects={projects} quotesByProject={quotesByProject} active={projectId} entries={calendarEntries} open={(id) => { setProjectId(id); setSelectedUid(''); setDraft(null); setView('dashboard'); }} add={addProject} addEntry={(entry) => setCalendarEntries((items) => [...items, entry])} deleteEntry={(id) => setCalendarEntries((items) => items.filter((item) => item.id !== id))} message={message} />}"
new_library_call = "          {view === 'projects' && <ProjectLibrary masters={masterProjects} projects={projects} quotesByProject={quotesByProject} activeMasterId={activeMasterId} entries={calendarEntries} open={openMasterProject} add={openMasterProjectManager} loadError={masterLoadError} />}"
if old_library_call in text:
    text = text.replace(old_library_call, new_library_call, 1)
elif '<ProjectLibrary masters={masterProjects}' not in text:
    raise SystemExit('Project Library render anchor not found')

replacement_library = r'''function ProjectLibrary({ masters, projects, quotesByProject, activeMasterId, entries, open, add, loadError }: { masters: MasterProjectMeta[]; projects: Project[]; quotesByProject: Record<string, Quote[]>; activeMasterId: string; entries: CalendarEntry[]; open: (id: string) => void; add: () => void; loadError: string }) {
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLowerCase();
  const sortedMasters = [...masters].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || alphaNumericCompare(a.name, b.name));
  const projectForLegacyId = (legacyId: string) => projects.find((project) => project.id === legacyId);
  const masterQuotes = (master: MasterProjectMeta) => master.engagements.flatMap((engagement) => quotesByProject[engagement.legacyId] || []);
  const masterClients = (master: MasterProjectMeta) => Array.from(new Set(master.engagements.map((engagement) => engagement.clientName || projectForLegacyId(engagement.legacyId)?.client || '').filter(Boolean))).sort(alphaNumericCompare);
  const visibleMasters = sortedMasters.filter((master) => {
    const quoteText = masterQuotes(master).map((quote) => `${quote.number} ${quote.name}`).join(' ');
    const clientText = masterClients(master).join(' ');
    return !normalized || `${master.projectNumber} ${master.name} ${master.location} ${master.status} ${master.systems.join(' ')} ${clientText} ${quoteText}`.toLowerCase().includes(normalized);
  });
  const totalQuotes = masters.reduce((sum, master) => sum + masterQuotes(master).length, 0);
  const upcomingDates = entries.filter((entry) => entry.date >= new Date().toISOString().slice(0, 10)).length;
  const activeProjects = masters.filter((master) => !master.isArchived && master.status !== 'Complete').length;
  return <>
    <PageHead eyebrow="ScopeLogic" title="Project Library" description="Search Master Projects, compare project status, and open the same ScopeLogic workspace used in the live application." action={<button className="primary" onClick={add}>+ New Master Project</button>} />
    {loadError && <div className="sync-note">Master Project status: <b>Could not refresh</b> — {loadError}</div>}
    <div className="project-library-metrics"><div><b>{masters.length}</b><span>Total Master Projects</span></div><div><b>{activeProjects}</b><span>Active Master Projects</span></div><div><b>{totalQuotes}</b><span>Total Quotes</span></div><div><b>{upcomingDates}</b><span>Upcoming Dates</span></div></div>
    <section className="project-list-section project-list-focus"><div className="project-list-heading"><div><span>Newest Created First</span><h2>ScopeLogic Master Projects and Quotes</h2></div><label className="project-library-search"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Master project, SLMP number, customer, status, or quote" /></label></div><div className="project-list-table"><div className="project-list-row head"><span>Project</span><span>Quote Numbers</span><span>Customer</span><span>Status</span><span>Contract</span><span>Revision</span><span></span></div>{visibleMasters.map((master) => {
      const quoteNumbers = Array.from(new Set(masterQuotes(master).map((quote) => { const parsed = parseQuoteNumber(quote.number); return parsed ? formatQuoteNumber({ ...quote, ...parsed }) : quote.number; }).filter(Boolean))).sort(alphaNumericCompare);
      const quoteNumberLabel = quoteNumbers.length ? quoteNumbers.join(', ') : 'No quotes';
      const clients = masterClients(master);
      const engagementProjects = master.engagements.map((engagement) => projectForLegacyId(engagement.legacyId)).filter(Boolean) as Project[];
      const contractStatuses = Array.from(new Set(engagementProjects.map((item) => item.contract.status).filter(Boolean)));
      const contractLabel = master.engagements.length > 1 ? `${master.engagements.length} engagements` : contractStatuses[0] || 'Draft';
      const clientLabel = clients.length ? clients.join('; ') : master.engagements.length ? 'Not entered' : 'No engagement';
      return <button key={master.id} className={`project-list-row ${master.id === activeMasterId ? 'selected' : ''}`} onClick={() => open(master.id)}><span><b>{master.name}</b><small>{master.projectNumber} · Created {new Date(master.createdAt).toLocaleDateString()}</small><small className="project-mobile-quotes">Quotes: {quoteNumberLabel}</small></span><span className="project-quote-numbers" title={quoteNumberLabel}>{quoteNumbers.length ? quoteNumbers.map((number) => <b key={number}>{number}</b>) : <small>No quotes</small>}</span><span>{clientLabel}</span><span><i>{master.status}</i></span><span>{contractLabel}</span><span>{master.revision}</span><span className="open-project">Open</span></button>;
    })}{!visibleMasters.length && <div className="empty-state"><b>{loadError ? 'Master Projects could not be loaded.' : 'No matching Master Projects.'}</b><p>{loadError ? 'Retry the cloud connection or reload the page.' : 'Try a different Master Project, SLMP number, customer, status, or quote search.'}</p></div>}</div></section>
  </>;
}'''
pattern = r"function ProjectLibrary\([\s\S]*?\n}\n\nfunction OfficialReleases"
if re.search(pattern, text):
    text = re.sub(pattern, replacement_library + "\n\nfunction OfficialReleases", text, count=1)
elif 'function ProjectLibrary({ masters, projects' not in text:
    raise SystemExit('ProjectLibrary function anchor not found')

if text == original:
    raise SystemExit('No workspace changes were applied')
path.write_text(text)
print('Patched app/workspace.tsx')
