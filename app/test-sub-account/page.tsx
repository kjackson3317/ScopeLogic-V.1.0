const TEST_SUB_ACCOUNT = {
  name: 'Test Sub Account',
  role: 'Standard User',
  assignedMaster: {
    number: 'SLMP-26008',
    name: 'Master Project Test',
    location: 'Common project baseline',
    status: 'Planning',
    revision: 'Rev 0',
    systems: ['Structured Cabling', 'CCTV', 'Access Control'],
    engagements: [
      { client: 'J&I Cordon', service: 'Product 1', label: 'Client Engagement', status: 'Planning' },
      { client: 'Reeves Young', service: 'Product 1', label: 'Client Engagement', status: 'Planning' },
    ],
  },
};

export default function TestSubAccountPage() {
  const master = TEST_SUB_ACCOUNT.assignedMaster;
  return <main className="mp-page">
    <header className="mp-topbar">
      <div>
        <div className="mp-eyebrow">ScopeLogic RC5.7 · Test Sub Account Preview</div>
        <h1>Master Projects</h1>
        <p>Previewing the app as a non-admin subordinate user. No real user account or email is required.</p>
      </div>
      <div className="mp-account">
        <strong>{TEST_SUB_ACCOUNT.name}</strong>
        <span>{TEST_SUB_ACCOUNT.role}</span>
      </div>
    </header>

    <div className="mp-message info"><strong>Test access rule:</strong> this user is assigned only to {master.number}. Other Master Projects and admin/assignment controls are intentionally hidden in this preview.</div>

    <section className="mp-grid">
      <aside className="mp-sidebar">
        <div className="mp-sidebar-head">
          <div className="mp-sidebar-title">Master Project Library</div>
          <div className="mp-tabs"><button className="active">Active</button><button>Archived</button></div>
        </div>
        <button className="mp-master-row active">
          <strong>{master.number} · {master.name}</strong>
          <span>{master.location}</span>
          <small>{master.engagements.length} Client Engagements</small>
        </button>
      </aside>

      <section className="mp-content">
        <div className="mp-hero">
          <div>
            <div className="mp-eyebrow">Master Project · {master.number}</div>
            <h2>{master.name}</h2>
            <p>{master.location}</p>
          </div>
          <div className="mp-actions wrap">
            <button className="mp-button secondary" disabled>Admin controls hidden</button>
          </div>
        </div>

        <div className="mp-summary">
          <div><span>Status</span><strong>{master.status}</strong></div>
          <div><span>Systems</span><strong>{master.systems.length}</strong></div>
          <div><span>Engagements</span><strong>{master.engagements.length}</strong></div>
          <div><span>Revision</span><strong>{master.revision}</strong></div>
        </div>

        <div className="mp-panel">
          <div className="mp-panel-head"><div><h3>Common Project Baseline</h3><p className="mp-muted">The subordinate can see shared Master Project information for assigned work.</p></div></div>
          <div className="mp-system-list">{master.systems.map((system) => <span key={system}>{system}</span>)}</div>
          <div className="mp-boundary"><strong>Access boundary</strong><p>This preview is deliberately limited to the assigned Master Project. It does not expose the Master Project manager, user-assignment administration, unassigned Masters, or other users' project libraries.</p></div>
        </div>

        <div className="mp-panel">
          <div className="mp-panel-head"><div><h3>Client Engagements</h3><p className="mp-muted">Only Client Engagements under the assigned Master Project are shown here.</p></div></div>
          <div className="mp-table-wrap"><table><thead><tr><th>Client / GC</th><th>Service</th><th>Label</th><th>Status</th><th>Access</th></tr></thead><tbody>
            {master.engagements.map((engagement) => <tr key={engagement.client}>
              <td><strong>{engagement.client}</strong></td>
              <td>{engagement.service}</td>
              <td>{engagement.label}</td>
              <td>{engagement.status}</td>
              <td><span className="mp-chip">Visible</span></td>
            </tr>)}
          </tbody></table></div>
        </div>

        <div className="mp-panel access-panel">
          <h3>Subordinate Access Preview</h3>
          <div className="access-grid">
            <div><span>Visible</span><strong>Assigned Master Projects</strong></div>
            <div><span>Visible</span><strong>Assigned project workspace</strong></div>
            <div><span>Visible</span><strong>Shared Master baseline</strong></div>
            <div><span>Hidden</span><strong>Other Master Projects</strong></div>
            <div><span>Hidden</span><strong>User assignment management</strong></div>
            <div><span>Hidden</span><strong>Admin-only project management</strong></div>
          </div>
        </div>
      </section>
    </section>

    <style>{`
      *{box-sizing:border-box}.mp-page{min-height:100vh;background:#f5f6f2;color:#202420;font-family:Arial,Helvetica,sans-serif;padding:28px}.mp-topbar{max-width:1440px;margin:0 auto 20px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.mp-topbar h1{font-size:32px;margin:3px 0}.mp-topbar p,.mp-panel p{margin:4px 0;color:#687067}.mp-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#59612b}.mp-account{background:white;border:1px solid #d9ddd3;border-radius:10px;padding:10px 14px;display:grid;gap:2px;min-width:180px}.mp-account span{font-size:12px;color:#687067}.mp-message{max-width:1440px;margin:0 auto 16px;border-radius:8px;padding:11px 14px}.mp-message.info{background:#f0f2ea;border:1px solid #ccd2c0;color:#3e4722}.mp-grid{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:320px 1fr;gap:18px}.mp-sidebar,.mp-panel,.mp-hero,.mp-summary{background:white;border:1px solid #d9ddd3;border-radius:12px}.mp-sidebar{padding:12px;align-self:start}.mp-sidebar-title{font-weight:800;padding:8px}.mp-sidebar-head{display:grid;gap:7px;margin-bottom:8px}.mp-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px}.mp-tabs button{border:1px solid #d9ddd3;background:white;border-radius:7px;padding:7px;font-weight:700}.mp-tabs button.active{background:#59612b;color:white;border-color:#59612b}.mp-master-row{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:9px;background:transparent;padding:11px;margin-bottom:5px}.mp-master-row.active{background:#f0f2ea;border-color:#ccd2c0}.mp-master-row strong,.mp-master-row span,.mp-master-row small{display:block}.mp-master-row span{font-size:12px;color:#687067;margin-top:4px}.mp-master-row small{font-size:11px;color:#59612b;margin-top:5px}.mp-content{min-width:0;display:grid;gap:14px}.mp-hero{padding:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}.mp-hero h2{font-size:26px;margin:2px 0}.mp-actions{display:flex;gap:10px}.mp-actions.wrap{flex-wrap:wrap;justify-content:flex-end}.mp-button{border:0;border-radius:8px;background:#59612b;color:white;font-weight:800;padding:11px 15px;font-size:14px}.mp-button.secondary{background:white;color:#272b27;border:1px solid #d9ddd3}.mp-button:disabled{opacity:.6}.mp-summary{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden}.mp-summary div{padding:14px 18px;border-right:1px solid #e1e4dc}.mp-summary div:last-child{border-right:0}.mp-summary span,.mp-summary strong{display:block}.mp-summary span{font-size:11px;color:#687067;text-transform:uppercase;font-weight:700}.mp-summary strong{font-size:16px;margin-top:4px}.mp-panel{padding:18px}.mp-panel h3{margin:0 0 6px}.mp-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mp-muted{max-width:1000px;line-height:1.5}.mp-system-list{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.mp-system-list span,.mp-chip{font-size:11px;border-radius:999px;background:#eef0e7;color:#59612b;padding:5px 8px;font-weight:700}.mp-table-wrap{overflow:auto;margin-top:12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e4e7df;padding:10px 8px;font-size:13px;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#687067}.mp-boundary{background:#f2f3ee;border-left:4px solid #59612b;padding:11px 13px;margin-top:15px}.mp-boundary p{margin:5px 0 0;color:#555d54;line-height:1.45;font-size:13px}.access-panel{border-style:dashed}.access-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.access-grid div{border:1px solid #e1e4dc;border-radius:8px;padding:11px}.access-grid span,.access-grid strong{display:block}.access-grid span{font-size:10px;text-transform:uppercase;color:#687067;font-weight:800;margin-bottom:4px}.access-grid strong{font-size:13px}@media(max-width:950px){.mp-page{padding:14px}.mp-topbar{display:block}.mp-account{margin-top:12px}.mp-grid{grid-template-columns:1fr}.mp-summary,.access-grid{grid-template-columns:1fr 1fr}.mp-hero{align-items:flex-start;flex-direction:column}}`}</style>
  </main>;
}
