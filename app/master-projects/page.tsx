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
