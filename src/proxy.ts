import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic redirect only: sends visitors without a session cookie to sign-in.
 * Real authorisation happens on the server for every page and API route.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has('att_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*', '/admin/:path*'] };
