import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/server';
import ReviewWorkflowPreview, { type PreviewEngagement, type PreviewMasterProject } from './review-workflow-preview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewWorkflowPreviewPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [mastersResult, engagementsResult] = await Promise.all([
    supabase
      .from('master_projects')
      .select('id,project_number,name,location,status,revision,systems,is_archived,created_at')
      .eq('is_archived', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('id,legacy_id,master_project_id,client_name,engagement_label,engagement_type,status')
      .not('master_project_id', 'is', null)
      .order('name'),
  ]);

  const engagements = ((engagementsResult.data || []) as Array<Record<string, unknown>>).map((row): PreviewEngagement => ({
    id: String(row.id || ''),
    legacyId: String(row.legacy_id || ''),
    masterProjectId: String(row.master_project_id || ''),
    clientName: String(row.client_name || ''),
    label: String(row.engagement_label || 'Client Engagement'),
    type: String(row.engagement_type || ''),
    status: String(row.status || 'Planning'),
  }));

  const masters = ((mastersResult.data || []) as Array<Record<string, unknown>>).map((row): PreviewMasterProject => ({
    id: String(row.id || ''),
    projectNumber: String(row.project_number || ''),
    name: String(row.name || ''),
    location: String(row.location || ''),
    status: String(row.status || 'Planning'),
    revision: String(row.revision || 'Rev 0'),
    systems: Array.isArray(row.systems) ? row.systems.map(String) : [],
    engagements: engagements.filter((engagement) => engagement.masterProjectId === String(row.id || '')),
  }));

  return <ReviewWorkflowPreview masters={masters} userEmail={user.email || 'Signed-in user'} />;
}
