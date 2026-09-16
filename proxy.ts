import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/proxy';
import { NextResponse } from 'next/server';
import { isEmployerDemo } from './lib/demo/config';

export async function proxy(request: NextRequest) {
  if (isEmployerDemo) {
    const path = request.nextUrl.pathname;
    if (path.startsWith('/api/') || path.startsWith('/auth/')) return NextResponse.json({ error: 'This presentation uses browser-local data only.' }, { status: 403 });
    if (path === '/' || path.startsWith('/demo/') || path === '/pdf.worker.min.mjs' || path.startsWith('/_next/')) return NextResponse.next();
    return NextResponse.redirect(new URL('/', request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
