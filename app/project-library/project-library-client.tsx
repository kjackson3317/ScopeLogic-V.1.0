'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

type MasterProject = {
  id: string;
  project_number: string;
  name: string;
  location: string;
  status: string;
  revision: string;
  systems: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type Engagement = { id: string; master_project_id: string | null };
type Notice = { kind: 'success' | 'error'; message: string } | null;

type Props = { actualUserId: string; role: string; userName: string };

const jobNumberSort = (a: MasterProject, b: MasterProject) =>
  String(a.project_number || '').localeCompare(String(b.project_number || ''), undefined, { numeric: true, sensitivity: 'base' });

const recentSort = (a: MasterProject, b: MasterProject) =>
  new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();

export default function ProjectLibraryClient({ role, userName }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = role === 'administrator' || role === 'manager';
  const [masters, setMasters] = useState<MasterProject[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [masterResult, engagementResult] = await Promise.all([
      supabase.from('master_projects').select('id,project_number,name,location,status,revision,systems,is_archived,created_at,updated_at').order('updated_at', { ascending: false }),
      supabase.from('projects').select('id,master_project_id'),
    ]);
    setLoading(false);
    const firstError = masterResult.error || engagementResult.error;
    if (firstError) { setError(firstError.message); return; }
    setMasters((masterResult.data || []).map((row: any) => ({ ...row, systems: Array.isArray(row.systems) ? row.systems : [] })) as MasterProject[]);
    setEngagements((engagementResult.data || []) as Engagement[]);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const normalized = search.trim().toLowerCase();
  const matchingStatus = masters.filter((master) => master.is_archived === showArchived);
  const visible = normalized
    ? matchingStatus
        .filter((master) => `${master.project_number} ${master.name}`.toLowerCase().includes(normalized))
        .sort(jobNumberSort)
    : viewAll
      ? [...matchingStatus].sort(jobNumberSort)
      : [...matchingStatus].sort(recentSort).slice(0, 5);

  const engagementCount = (masterId: string) => engagements.filter((engagement) => engagement.master_project_id === masterId).length;
  const activeCount = masters.filter((master) => !master.is_archived && !['Complete'].includes(master.status)).length;

  const deleteProject = async (master: MasterProject) => {
    const linked = engagementCount(master.id);
    if (linked) {
      setNotice({ kind: 'error', message: `${master.project_number} cannot be deleted because it has ${linked} Client Engagement${linked === 1 ? '' : 's'}. Archive it or remove/reassign those engagements first.` });
      return;
    }
    if (!window.confirm(`Permanently delete ${master.project_number} - ${master.name}? This cannot be undone.`)) return;
    const result = await supabase.from('master_projects').delete().eq('id', master.id);
    if (result.error) {
      setNotice({ kind: 'error', message: `Project delete failed: ${result.error.message}` });
      return;
    }
    setNotice({ kind: 'success', message: `${master.project_number} deleted successfully.` });
    await load();
  };

  return <main className="library-page">
    {notice ? <div className={`library-toast ${notice.kind}`} role="status">{notice.message}</div> : null}
    <header className="library-header">
      <div>
        <div className="eyebrow">ScopeLogic RC5.7</div>
        <h1>Project Library</h1>
        <p>One project library for the Master Projects assigned to your ScopeLogic account.</p>
      </div>
      <div className="header-actions">
        {isAdmin ? <a className="button secondary" href="/master-projects">Project Setup</a> : null}
        <a className="button" href="/master-projects">+ New Master Project</a>
      </div>
    </header>

    {error ? <div className="error-box"><strong>Project Library could not load.</strong><span>{error}</span><button onClick={() => void load()}>Retry</button></div> : null}

    <section className="metrics">
      <div><b>{masters.filter((master) => !master.is_archived).length}</b><span>Active Master Projects</span></div>
      <div><b>{activeCount}</b><span>Open / In Progress</span></div>
      <div><b>{engagements.length}</b><span>Client Engagements</span></div>
      <div><b>{masters.filter((master) => master.is_archived).length}</b><span>Archived</span></div>
    </section>

    <section className="library-panel">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="tabs"><button className={!showArchived ? 'active' : ''} onClick={() => { setShowArchived(false); setViewAll(false); }}>Existing Projects</button><button className={showArchived ? 'active' : ''} onClick={() => { setShowArchived(true); setViewAll(false); }}>Archived</button></div>
          {!normalized ? <button className="view-all" type="button" onClick={() => setViewAll((current) => !current)}>{viewAll ? 'Show Recent 5' : 'View All Projects'}</button> : null}
        </div>
        <label><span>Search Projects</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project number or project name" /></label>
      </div>

      {!loading && !normalized && !viewAll && matchingStatus.length > 5 ? <div className="recent-note">Showing the 5 most recently worked-on projects. Search by project number/name or choose View All Projects.</div> : null}
      {!loading && !normalized && viewAll ? <div className="recent-note">Showing all projects in project-number order.</div> : null}

      {loading ? <div className="empty">Loading Project Library…</div> : visible.length ? <div className="project-table">
        <div className="project-row head"><span>Project</span><span>Location</span><span>Systems</span><span>Engagements</span><span>Status</span><span>Revision</span><span></span></div>
        {visible.map((master) => <div key={master.id} className="project-row">
          <span><b>{master.project_number}</b><strong>{master.name}</strong><small>Updated {new Date(master.updated_at || master.created_at).toLocaleDateString()}</small></span>
          <span>{master.location || 'Not entered'}</span>
          <span>{master.systems.length ? master.systems.join(', ') : 'Not selected'}</span>
          <span>{engagementCount(master.id)}</span>
          <span><i>{master.status}</i></span>
          <span>{master.revision}</span>
          <span className="row-actions"><a className="open" href={`/master-projects/${master.id}`}>Open</a><button type="button" onClick={() => void deleteProject(master)}>Delete</button></span>
        </div>)}
      </div> : <div className="empty"><b>No matching {showArchived ? 'archived' : 'existing'} projects.</b><p>{isAdmin ? 'Create or assign a Master Project to populate the library.' : 'Ask your ScopeLogic administrator to assign you to a Master Project.'}</p></div>}
    </section>

    <footer>Signed in as {userName}</footer>

    <style jsx>{`
      .library-page{min-height:100vh;background:#f5f6f2;color:#202420;font-family:Arial,Helvetica,sans-serif;padding:28px}.library-toast{position:fixed;right:24px;top:24px;z-index:2000;max-width:460px;padding:12px 15px;border-radius:9px;box-shadow:0 12px 32px rgba(0,0,0,.16);font-size:13px;font-weight:800}.library-toast.success{background:#edf6e8;border:1px solid #9ab18b;color:#294322}.library-toast.error{background:#fff0ed;border:1px solid #d7a49c;color:#7b2922}.library-header{max-width:1500px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:flex-end;gap:22px}.library-header h1{font-size:34px;margin:4px 0}.library-header p{margin:0;color:#687067}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#59612b}.header-actions{display:flex;gap:9px;flex-wrap:wrap}.button{padding:11px 15px;border-radius:8px;background:#59612b;color:#fff;text-decoration:none;font-size:13px;font-weight:800}.button.secondary{background:#fff;color:#292d29;border:1px solid #d8ddd3}.metrics{max-width:1500px;margin:0 auto 14px;background:#fff;border:1px solid #d9ddd3;border-radius:12px;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden}.metrics div{padding:17px;border-right:1px solid #e1e4dc}.metrics div:last-child{border-right:0}.metrics b,.metrics span{display:block}.metrics b{font-size:24px}.metrics span{font-size:11px;text-transform:uppercase;color:#687067;margin-top:4px;font-weight:700}.library-panel{max-width:1500px;margin:0 auto;background:#fff;border:1px solid #d9ddd3;border-radius:12px;overflow:hidden}.toolbar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:15px 17px;border-bottom:1px solid #e4e7df}.toolbar-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tabs{display:flex;gap:5px}.tabs button,.view-all{border:1px solid #d8ddd3;background:#fff;border-radius:7px;padding:8px 12px;font-weight:800;cursor:pointer}.tabs button.active{background:#59612b;color:#fff;border-color:#59612b}.view-all{color:#59612b}.toolbar label{width:min(540px,60vw);font-size:11px;font-weight:800;text-transform:uppercase;color:#687067}.toolbar label span{display:block;margin-bottom:5px}.toolbar input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #ccd1c7;border-radius:7px}.recent-note{padding:8px 17px;border-bottom:1px solid #e4e7df;background:#f8faf5;color:#697064;font-size:11px}.project-table{overflow:auto}.project-row{display:grid;grid-template-columns:2fr 1.1fr 1.6fr .7fr .8fr .65fr .75fr;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid #e7e9e3;color:inherit;min-width:1080px}.project-row:not(.head):hover{background:#f3f4ef}.project-row.head{font-size:10px;text-transform:uppercase;font-weight:800;color:#687067;background:#fafbf8}.project-row span{font-size:13px}.project-row span:first-child b,.project-row span:first-child strong,.project-row span:first-child small{display:block}.project-row span:first-child b{color:#59612b;font-size:12px;margin-bottom:3px}.project-row span:first-child strong{font-size:14px}.project-row span:first-child small{color:#777f76;margin-top:4px}.project-row i{font-style:normal;padding:5px 8px;background:#eef0e7;color:#59612b;border-radius:999px;font-size:11px;font-weight:800}.row-actions{display:flex;gap:7px;align-items:center}.row-actions a,.row-actions button{border:1px solid #ccd1c7;border-radius:6px;background:#fff;padding:6px 8px;font-size:11px;font-weight:900;text-decoration:none;cursor:pointer}.row-actions .open{color:#59612b}.row-actions button{color:#8a3028}.empty{padding:40px;text-align:center;color:#687067}.empty b{color:#2d322d}.error-box{max-width:1500px;margin:0 auto 14px;background:#fff1ef;border:1px solid #ddb9b4;border-radius:9px;padding:12px 14px;color:#742d27;display:flex;gap:10px;align-items:center}.error-box span{flex:1}.error-box button{border:0;border-radius:6px;padding:7px 10px;cursor:pointer}footer{max-width:1500px;margin:14px auto 0;color:#7b817a;font-size:11px}@media(max-width:850px){.library-page{padding:14px}.library-header{display:block}.header-actions{margin-top:12px}.metrics{grid-template-columns:1fr 1fr}.toolbar{align-items:stretch;flex-direction:column}.toolbar label{width:100%}}
    `}</style>
  </main>;
}
