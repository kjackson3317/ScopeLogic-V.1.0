import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/server';
import CrmClient from './crm-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CrmPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <CrmClient userEmail={user.email || 'Signed-in user'} />;
}
