import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        application: 'ok',
        database: 'unconfigured',
        authentication: 'unknown',
        checkedAt,
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('scopelogic_public_healthcheck');

    if (error || !data?.ok) {
      return NextResponse.json(
        {
          ok: false,
          application: 'ok',
          database: 'error',
          authentication: 'reachable',
          detail: error?.message || 'Database health check did not return ok.',
          checkedAt,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        application: 'ok',
        database: 'ok',
        authentication: 'reachable',
        checkedAt,
      },
      {
        status: 200,
        headers: {
          'cache-control': 'no-store, max-age=0',
        },
      },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        ok: false,
        application: 'ok',
        database: 'unreachable',
        authentication: 'unknown',
        detail: cause instanceof Error ? cause.message : 'Unknown backend failure.',
        checkedAt,
      },
      { status: 503 },
    );
  }
}
