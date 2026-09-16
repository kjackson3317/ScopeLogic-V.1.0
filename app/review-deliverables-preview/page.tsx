import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/server';
import ReviewDeliverablesPreview, { type PreviewMasterProject } from './review-deliverables-preview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewDeliverablesPreviewPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('master_projects')
    .select('id,project_number,name,location,status,revision,systems,is_archived,created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  const masters = ((data || []) as Array<Record<string, unknown>>).map((row): PreviewMasterProject => ({
    id: String(row.id || ''),
    projectNumber: String(row.project_number || ''),
    name: String(row.name || ''),
    location: String(row.location || ''),
    status: String(row.status || 'Planning'),
    revision: String(row.revision || 'Rev 0'),
    systems: Array.isArray(row.systems) ? row.systems.map(String) : [],
  }));

  return <ReviewDeliverablesPreview masters={masters} userEmail={user.email || 'Signed-in user'} />;
}
