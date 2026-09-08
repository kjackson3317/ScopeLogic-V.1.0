'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '../../../lib/supabase/client';

type MasterProject = { id: string; project_number: string; name: string; is_archived: boolean };

type Result = { ok?: boolean; userId?: string; existing?: boolean; role?: string; assignedMasterCount?: number; error?: string };

export default function UserAdminClient() {
  const supabase = useMemo(() => createClient(), []);
  const [masters, setMasters] = useState<MasterProject[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [assignedMasterIds, setAssignedMasterIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const { data, error: loadError } = await supabase
        .from('master_projects')
        .select('id,project_number,name,is_archived')
        .eq('is_archived', false)
        .order('project_number');
      if (loadError) { setError(loadError.message); return; }
      setMasters((data || []) as MasterProject[]);
    })();
  }, [supabase]);

  const toggleMaster = (id: string) => {
    setAssignedMasterIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('scopelogic-user-admin', {
        body: { email: email.trim(), fullName: fullName.trim(), password, masterProjectIds: assignedMasterIds },
      });
      if (invokeError) throw invokeError;
      const result = (data || {}) as Result;
      if (!result.ok) throw new Error(result.error || 'User could not be created.');
      setMessage(`${result.existing ? 'User updated' : 'User created'} successfully as a standard user with ${result.assignedMasterCount || 0} Master Project assignment${result.assignedMasterCount === 1 ? '' : 's'}.`);
      setEmail(''); setFullName(''); setPassword(''); setAssignedMasterIds([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'User could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="ua-page">
    <header className="ua-topbar">
      <div>
        <div className="ua-eyebrow">ScopeLogic Administration</div>
        <h1>User Management</h1>
        <p>Create a standard user login and assign the Master Projects that should appear in that user's Project Library.</p>
      </div>
      <a className="ua-button secondary" href="/master-projects">Back to Master Projects</a>
    </header>

    <section className="ua-card">
      <form onSubmit={submit}>
        <div className="ua-two">
          <label><span>Full Name</span><input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label><span>Email Address</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        </div>
        <label><span>Initial Password</span><input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><small>Minimum 10 characters. The user can change it later with Forgot Password.</small></label>

        <div className="ua-section-title"><strong>Master Project Access</strong><span>Select only the projects this user should see.</span></div>
        <div className="ua-master-list">
          {masters.length ? masters.map((master) => <label className="ua-master" key={master.id}>
            <input type="checkbox" checked={assignedMasterIds.includes(master.id)} onChange={() => toggleMaster(master.id)} />
            <span><strong>{master.project_number} · {master.name}</strong><small>Visible in this user's Project Library</small></span>
          </label>) : <div className="ua-empty">No active Master Projects found.</div>}
        </div>

        <div className="ua-note"><strong>Permissions</strong><p>Accounts created here are standard users. They cannot manage other users or see unassigned Master Projects. Assignments can be changed by submitting the same email again with the desired Master Projects selected.</p></div>

        {message ? <div className="ua-message success">{message}</div> : null}
        {error ? <div className="ua-message error">{error}</div> : null}

        <div className="ua-actions"><button className="ua-button" disabled={busy}>{busy ? 'Saving…' : 'Create / Update User'}</button></div>
      </form>
    </section>

    <style>{`
      *{box-sizing:border-box}.ua-page{min-height:100vh;background:#f5f6f2;color:#202420;font-family:Arial,Helvetica,sans-serif;padding:28px}.ua-topbar{max-width:1100px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.ua-topbar h1{font-size:32px;margin:3px 0}.ua-topbar p{color:#687067;margin:4px 0;max-width:720px;line-height:1.45}.ua-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#59612b}.ua-card{max-width:1100px;margin:0 auto;background:white;border:1px solid #d9ddd3;border-radius:12px;padding:22px}.ua-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}label>span{display:block;font-size:12px;font-weight:800;margin:0 0 5px}input{width:100%;border:1px solid #ccd1c7;border-radius:7px;padding:10px;font:inherit}label small{display:block;color:#687067;font-size:11px;margin-top:5px}.ua-section-title{margin:22px 0 10px}.ua-section-title strong,.ua-section-title span{display:block}.ua-section-title span{font-size:12px;color:#687067;margin-top:3px}.ua-master-list{border:1px solid #dfe3da;border-radius:10px;overflow:hidden}.ua-master{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-bottom:1px solid #e5e8e1;cursor:pointer}.ua-master:last-child{border-bottom:0}.ua-master input{width:auto;margin-top:2px}.ua-master span{margin:0}.ua-master strong,.ua-master small{display:block}.ua-master small{margin-top:3px}.ua-empty{padding:14px;color:#687067}.ua-note{background:#f2f3ee;border-left:4px solid #59612b;padding:11px 13px;margin-top:18px}.ua-note p{margin:5px 0 0;color:#555d54;line-height:1.45;font-size:13px}.ua-message{margin-top:15px;border-radius:8px;padding:11px 13px}.ua-message.success{background:#eef3e7;border:1px solid #c7d2b8;color:#3e4a26}.ua-message.error{background:#fff1ef;border:1px solid #e0b9b4;color:#762d27}.ua-actions{display:flex;justify-content:flex-end;margin-top:18px}.ua-button{border:0;border-radius:8px;background:#59612b;color:white;font-weight:800;padding:11px 15px;cursor:pointer;text-decoration:none;font-size:14px}.ua-button.secondary{background:white;color:#272b27;border:1px solid #d9ddd3}.ua-button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:800px){.ua-page{padding:14px}.ua-topbar{display:block}.ua-topbar .ua-button{display:inline-block;margin-top:12px}.ua-two{grid-template-columns:1fr}}
    `}</style>
  </main>;
}
