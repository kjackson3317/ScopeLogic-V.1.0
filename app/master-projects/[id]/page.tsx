import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/server';
import MasterWorkspaceClientV2 from './master-workspace-client-v2';

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

  return <MasterWorkspaceClientV2
    masterProjectId={resolved.id}
    actualUserId={user.id}
    workspaceOwnerId={String(profile?.workspace_owner_id || user.id)}
    role={String(profile?.role || 'user')}
    userName={String(profile?.full_name || user.email || 'User')}
  />;
}
