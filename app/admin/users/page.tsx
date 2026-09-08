import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/server';
import UserAdminClient from './user-admin-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserAdminPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = String(profile?.role || 'user');
  if (!['administrator', 'manager'].includes(role)) redirect('/');

  return <UserAdminClient />;
}
