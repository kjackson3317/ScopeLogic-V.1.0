import { NextResponse } from 'next/server';

// The employer demo intentionally strips production brand image files from the
// disposable build checkout. Review-release PDFs still request the same image
// URLs as production, so serve a transparent PNG placeholder in demo builds.
// The PDF retains its ScopeLogic document titles/headers without reconnecting
// the demo to production assets or storage.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export async function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params;
  if (asset !== 'scopelogic-logo-mark.png' && asset !== 'scopelogic-wordmark.png') {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
    },
  });
}
