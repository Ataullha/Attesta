import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic redirect only: sends visitors without a session cookie to sign-in.
 * Real authorisation happens on the server for every page and API route.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has('att_session')) {
    const url = req.nextUrl.clone();
    // Keep the query string so e.g. /app/bulk?template=… survives the sign-in round trip.
    const back = req.nextUrl.pathname + req.nextUrl.search;
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(back)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*', '/admin/:path*'] };
