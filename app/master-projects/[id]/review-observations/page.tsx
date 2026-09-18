import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../../../lib/supabase/server';
import ReviewObservationsClient from './review-observations-client';

export const dynamic='force-dynamic';
export const revalidate=0;

export default async function ReviewObservationsPage({params}:{params:Promise<{id:string}>}){
 await connection();
 if(!isSupabaseConfigured())redirect('/');
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const resolved=await params;
 return <ReviewObservationsClient masterProjectId={resolved.id}/>;
}
