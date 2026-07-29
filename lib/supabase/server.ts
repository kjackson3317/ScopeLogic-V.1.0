import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function readSupabaseConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = readSupabaseConfig();
  return Boolean(url && key);
}

export async function createClient() {
  const { url, key } = readSupabaseConfig();
  if (!url || !key) {
    throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the active Vercel environment, then redeploy.');
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write cookies. proxy.ts handles refreshes.
        }
      },
    },
  });
}
