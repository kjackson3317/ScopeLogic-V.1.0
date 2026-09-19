'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const GUEST_EMAIL = 'guest@technologyworkspace.test';
const GUEST_PASSWORD = 'GuestDemo2026!';

export default function DemoGuestLogin({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(GUEST_EMAIL);
  const [password, setPassword] = useState(GUEST_PASSWORD);
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (email.trim().toLowerCase() !== GUEST_EMAIL || password !== GUEST_PASSWORD) {
      setError('Use the guest credentials shown below.');
      return;
    }
    document.cookie = 'technology_workspace_guest=1; Max-Age=28800; Path=/; SameSite=Lax; Secure';
    router.replace(nextPath || '/');
    router.refresh();
  };

  return <form className="auth-form" onSubmit={submit}>
    <label><span>Guest email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary auth-submit" type="submit">Enter Test Workspace</button>
    <div style={{marginTop:10,padding:'8px 10px',border:'1px solid #87996c',background:'#f1f5ed',fontSize:11,lineHeight:1.45}}>
      <b>Guest access</b><br />
      Email: <code>{GUEST_EMAIL}</code><br />
      Password: <code>{GUEST_PASSWORD}</code>
    </div>
  </form>;
}
