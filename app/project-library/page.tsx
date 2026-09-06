import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/server';
import ProjectLibraryClient from './project-library-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectLibraryPage() {
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

  return <ProjectLibraryClient
    actualUserId={user.id}
    role={String(profile?.role || 'user')}
    userName={String(profile?.full_name || user.email || 'User')}
  />;
}
