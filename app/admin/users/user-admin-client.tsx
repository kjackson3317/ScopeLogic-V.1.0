'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '../../../lib/supabase/client';

type MasterProject = { id: string; project_number: string; name: string; is_archived: boolean };
type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  assignedMasterCount: number;
  isCaller: boolean;
};
type Result = {
  ok?: boolean;
  userId?: string;
  existing?: boolean;
  role?: string;
  assignedMasterCount?: number;
  users?: ManagedUser[];
  error?: string;
};

export default function UserAdminClient() {
  const supabase = useMemo(() => createClient(), []);
  const [masters, setMasters] = useState<MasterProject[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [assignedMasterIds, setAssignedMasterIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<ManagedUser | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    const { data, error: invokeError } = await supabase.functions.invoke('scopelogic-user-admin', {
      body: { action: 'list' },
    });
    if (invokeError) throw invokeError;
    const result = (data || {}) as Result;
    if (!result.ok) throw new Error(result.error || 'Users could not be loaded.');
    setUsers(result.users || []);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('master_projects')
          .select('id,project_number,name,is_archived')
          .eq('is_archived', false)
          .order('project_number');
        if (loadError) throw loadError;
        setMasters((data || []) as MasterProject[]);
        await loadUsers();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'User Management could not be loaded.');
      }
    })();
  }, [supabase, loadUsers]);

  const toggleMaster = (id: string) => {
    setAssignedMasterIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('scopelogic-user-admin', {
        body: {
          action: 'save',
          email: email.trim(),
          fullName: fullName.trim(),
          password,
          masterProjectIds: assignedMasterIds,
        },
      });
      if (invokeError) throw invokeError;
      const result = (data || {}) as Result;
      if (!result.ok) throw new Error(result.error || 'User could not be created.');
      setMessage(
        `${result.existing ? 'Existing user replaced' : 'User created'} successfully as a standard user with ${result.assignedMasterCount || 0} Master Project assignment${result.assignedMasterCount === 1 ? '' : 's'}.`
      );
      setEmail('');
      setFullName('');
      setPassword('');
      setAssignedMasterIds([]);
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'User could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    if (user.isCaller || user.role !== 'user') return;
    setDeletingUserId(user.id);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('scopelogic-user-admin', {
        body: { action: 'delete', userId: user.id },
      });
      if (invokeError) throw invokeError;
      const result = (data || {}) as Result;
      if (!result.ok) throw new Error(result.error || 'User could not be deleted.');
      setMessage(`${user.email} was deleted. You can now create a fresh account below.`);
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'User could not be deleted.');
    } finally {
      setDeletingUserId('');
      setDeleteCandidate(null);
    }
  };

  return <main className="ua-page">
    <header className="ua-topbar">
      <div>
        <div className="ua-eyebrow">ScopeLogic Administration</div>
        <h1>User Management</h1>
        <p>Create standard user logins, assign Master Project access, and remove existing standard users.</p>
      </div>
      <a className="ua-button secondary" href="/master-projects">Back to Master Projects</a>
    </header>

    <section className="ua-card">
      <div className="ua-section-title ua-section-title-first">
        <strong>Current Users</strong>
        <span>Administrators cannot be deleted from this page. Standard users can be removed and recreated.</span>
      </div>

      <div className="ua-user-list">
        {users.length ? users.map((user) => <div className="ua-user-row" key={user.id}>
          <div>
            <strong>{user.fullName || user.email}</strong>
            <span>{user.email}</span>
            <small>{user.role} · {user.assignedMasterCount} Master Project assignment{user.assignedMasterCount === 1 ? '' : 's'}</small>
          </div>
          {user.role === 'user' && !user.isCaller
            ? <button
                className="ua-button danger"
                type="button"
                disabled={Boolean(deletingUserId)}
                onClick={() => setDeleteCandidate(user)}
              >
                {deletingUserId === user.id ? 'Deleting…' : 'Delete User'}
              </button>
            : <span className="ua-protected">Protected</span>}
        </div>) : <div className="ua-empty">No users found.</div>}
      </div>

      <div className="ua-divider" />

      <div className="ua-section-title">
        <strong>Create / Replace User</strong>
        <span>If the email already exists, ScopeLogic replaces that standard-user account through Supabase Auth and applies the password and project assignments entered below.</span>
      </div>

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

        <div className="ua-note"><strong>Permissions</strong><p>Accounts created here are standard users. They cannot manage other users or see unassigned Master Projects.</p></div>

        {message ? <div className="ua-message success">{message}</div> : null}
        {error ? <div className="ua-message error">{error}</div> : null}

        <div className="ua-actions"><button className="ua-button" disabled={busy}>{busy ? 'Saving…' : 'Create / Replace User'}</button></div>
      </form>
    </section>

    {deleteCandidate ? <div className="ua-modal-backdrop" role="presentation">
      <section className="ua-modal" role="dialog" aria-modal="true" aria-labelledby="ua-delete-title">
        <div className="ua-eyebrow">Confirm User Deletion</div>
        <h2 id="ua-delete-title">Delete standard user?</h2>
        <p><strong>{deleteCandidate.email}</strong> will lose access immediately. Any assigned projects are transferred back to the workspace administrator before the account is removed.</p>
        <div className="ua-modal-actions">
          <button className="ua-button secondary" type="button" disabled={Boolean(deletingUserId)} onClick={() => setDeleteCandidate(null)}>Cancel</button>
          <button className="ua-button danger" type="button" disabled={Boolean(deletingUserId)} onClick={() => void deleteUser(deleteCandidate)}>{deletingUserId ? 'Deleting…' : 'Delete User'}</button>
        </div>
      </section>
    </div> : null}

    <style>{`
      *{box-sizing:border-box}.ua-page{min-height:100vh;background:#f5f6f2;color:#202420;font-family:Arial,Helvetica,sans-serif;padding:28px}.ua-topbar{max-width:1100px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.ua-topbar h1{font-size:32px;margin:3px 0}.ua-topbar p{color:#687067;margin:4px 0;max-width:720px;line-height:1.45}.ua-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#59612b}.ua-card{max-width:1100px;margin:0 auto;background:white;border:1px solid #d9ddd3;border-radius:12px;padding:22px}.ua-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}label>span{display:block;font-size:12px;font-weight:800;margin:0 0 5px}input{width:100%;border:1px solid #ccd1c7;border-radius:7px;padding:10px;font:inherit}label small{display:block;color:#687067;font-size:11px;margin-top:5px}.ua-section-title{margin:22px 0 10px}.ua-section-title-first{margin-top:0}.ua-section-title strong,.ua-section-title span{display:block}.ua-section-title span{font-size:12px;color:#687067;margin-top:3px}.ua-user-list{border:1px solid #dfe3da;border-radius:10px;overflow:hidden}.ua-user-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px;border-bottom:1px solid #e5e8e1}.ua-user-row:last-child{border-bottom:0}.ua-user-row strong,.ua-user-row span,.ua-user-row small{display:block}.ua-user-row>div>span{font-size:12px;color:#4f574e;margin-top:2px}.ua-user-row small{font-size:11px;color:#687067;margin-top:4px}.ua-protected{font-size:11px;color:#687067;font-weight:700}.ua-divider{height:1px;background:#e5e8e1;margin:24px 0}.ua-master-list{border:1px solid #dfe3da;border-radius:10px;overflow:hidden}.ua-master{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-bottom:1px solid #e5e8e1;cursor:pointer}.ua-master:last-child{border-bottom:0}.ua-master input{width:auto;margin-top:2px}.ua-master span{margin:0}.ua-master strong,.ua-master small{display:block}.ua-master small{margin-top:3px}.ua-empty{padding:14px;color:#687067}.ua-note{background:#f2f3ee;border-left:4px solid #59612b;padding:11px 13px;margin-top:18px}.ua-note p{margin:5px 0 0;color:#555d54;line-height:1.45;font-size:13px}.ua-message{margin-top:15px;border-radius:8px;padding:11px 13px}.ua-message.success{background:#eef3e7;border:1px solid #c7d2b8;color:#3e4a26}.ua-message.error{background:#fff1ef;border:1px solid #e0b9b4;color:#762d27}.ua-actions{display:flex;justify-content:flex-end;margin-top:18px}.ua-button{border:0;border-radius:8px;background:#59612b;color:white;font-weight:800;padding:11px 15px;cursor:pointer;text-decoration:none;font-size:14px}.ua-button.secondary{background:white;color:#272b27;border:1px solid #d9ddd3}.ua-button.danger{background:#7b352f}.ua-modal-backdrop{position:fixed;inset:0;background:rgba(20,24,20,.45);display:grid;place-items:center;padding:20px;z-index:1000}.ua-modal{width:min(480px,100%);background:#fff;border:1px solid #d9ddd3;border-radius:12px;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.22)}.ua-modal h2{font-size:22px;margin:6px 0 10px}.ua-modal p{margin:0;color:#555d54;line-height:1.5}.ua-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.ua-button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:800px){.ua-page{padding:14px}.ua-topbar{display:block}.ua-topbar .ua-button{display:inline-block;margin-top:12px}.ua-two{grid-template-columns:1fr}.ua-user-row{align-items:flex-start;flex-direction:column}}
    `}</style>
  </main>;
}
