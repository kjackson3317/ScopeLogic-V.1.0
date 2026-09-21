import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/proxy';
import { isEmployerDemo } from './lib/demo/config';

export async function proxy(request: NextRequest) {
  if (isEmployerDemo) {
    const path = request.nextUrl.pathname;
    if (path.startsWith('/api/') || path.startsWith('/auth/')) return NextResponse.json({ error: 'This presentation uses browser-local data only.' }, { status: 403 });
    if (path === '/login' || path === '/demo/sidebar-smoke' || path === '/demo/workspace-smoke' || path === '/pdf.worker.min.mjs' || path.startsWith('/_next/')) return NextResponse.next();

    const guest = request.cookies.get('technology_workspace_guest')?.value === '1';
    if (!guest) {
      const login = new URL('/login', request.url);
      const requested = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      if (requested !== '/') login.searchParams.set('next', requested);
      return NextResponse.redirect(login);
    }

    if (path === '/' || path.startsWith('/demo/')) return NextResponse.next();
    return NextResponse.redirect(new URL('/', request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
