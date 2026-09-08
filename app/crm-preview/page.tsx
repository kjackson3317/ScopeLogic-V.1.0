import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/server';
import CrmPreviewClient from './crm-preview-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CrmPreviewPage() {
  await connection();

  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <CrmPreviewClient userEmail={user.email || 'Signed-in user'} />;
}
