import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/server';
import MasterWorkspaceClientV3 from './master-workspace-client-v3';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MasterWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const resolved = await params;
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_owner_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  return <>
    <a
      href={`/master-projects/${resolved.id}/deliverables`}
      style={{position:'fixed',right:20,top:14,zIndex:80,background:'#173e63',color:'#fff',padding:'9px 13px',borderRadius:7,textDecoration:'none',fontSize:12,fontWeight:700,boxShadow:'0 2px 8px rgba(0,0,0,.16)'}}
    >
      Review Deliverables
    </a>
    <MasterWorkspaceClientV3
      masterProjectId={resolved.id}
      actualUserId={user.id}
      workspaceOwnerId={String(profile?.workspace_owner_id || user.id)}
      role={String(profile?.role || 'user')}
      userName={String(profile?.full_name || user.email || 'User')}
    />
  </>;
}
