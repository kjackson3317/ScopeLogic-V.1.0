import { NextResponse } from 'next/server';

// The employer demo intentionally strips production brand image files from the
// disposable build checkout. Review-release PDFs still request /brand/*.png,
// so the demo serves a transparent PNG placeholder for those requests. This
// keeps PDF generation self-contained without reconnecting production assets.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export async function GET() {
  return new NextResponse(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
    },
  });
}
