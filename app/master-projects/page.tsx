import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/server';
import MasterProjectsClient from './master-projects-client';
import MasterProjectCopyControl from './master-project-copy-control';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MasterProjectsPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_owner_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const workspaceOwnerId = String(profile?.workspace_owner_id || user.id);

  return (
    <>
      <div style={{ padding: '10px 18px 0', background: '#f5f6f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 10px', border: '1px solid #cad8ba', borderRadius: 8, background: '#f2f6ed', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12 }}>
          <span><b>Feature Preview:</b> unified Master Project Library, document-review notebook, evidence grouping, optional address fields, and SLR/checklist templates.</span>
          <a href="/review-workflow-preview" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '4px 9px', borderRadius: 6, background: '#526d2f', color: '#fff', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Open Review Workflow Preview</a>
        </div>
      </div>
      <MasterProjectsClient
        actualUserId={user.id}
        workspaceOwnerId={workspaceOwnerId}
        role={String(profile?.role || 'user')}
        userName={String(profile?.full_name || user.email || 'User')}
      />
      <MasterProjectCopyControl actualUserId={user.id} workspaceOwnerId={workspaceOwnerId} />
    </>
  );
}
