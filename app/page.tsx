import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../lib/supabase/server';
import Workspace from './workspace';

// Authentication depends on request cookies and deployment environment variables.
// Prevent Next.js from attempting to prerender this protected page during build.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ConfigurationRequired() {
  return <main className="auth-page"><section className="auth-card">
    <img className="auth-logo" src="/brand/scopelogic-logo-full.png" alt="ScopeLogic LLC" />
    <div className="auth-heading">
      <span>Production Configuration</span>
      <h1>Supabase connection required</h1>
      <p>ScopeLogic is deployed, but the production environment cannot read its Supabase connection settings.</p>
    </div>
    <div className="auth-error" role="alert">
      Add <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and <strong>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</strong> to this Vercel environment, then redeploy.
    </div>
  </section></main>;
}

export default async function HomePage() {
  // Next.js 16: wait for a real request before reading deployment environment values.
  await connection();

  if (!isSupabaseConfigured()) return <ConfigurationRequired />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <>
    <a
      href="/master-projects"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 4000,
        padding: '10px 14px',
        borderRadius: 999,
        background: '#59612b',
        color: '#fff',
        fontWeight: 800,
        fontSize: 13,
        textDecoration: 'none',
        boxShadow: '0 5px 18px rgba(0,0,0,.18)',
      }}
    >
      Master Projects
    </a>
    <Workspace userEmail={user.email || 'Signed-in user'} userId={user.id} />
  </>;
}
