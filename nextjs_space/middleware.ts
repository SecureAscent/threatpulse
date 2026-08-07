import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Edge middleware.
 *
 * Responsibilities:
 *  1. Gate interactive page routes behind a NextAuth session.
 *  2. Restrict admin-only page routes to ADMIN/SUPERADMIN.
 *  3. Attach baseline security headers to every matched response.
 *
 * NOTE on API-key auth: machine-to-machine access via
 * `Authorization: Bearer tp_...` is validated inside the API route handlers
 * through `getTenantContext(req)` — NOT here. Edge middleware cannot open a
 * Prisma/Postgres connection to hash-and-look-up the key, so key validation
 * deliberately happens in the Node.js runtime where the route executes.
 */

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export default withAuth(
  function middleware(req: any) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token;
    const isAdminRole =
      token?.role === 'ADMIN' ||
      token?.role === 'PARENT_ADMIN' ||
      token?.role === 'SUPERADMIN';

    // Admin-only page routes
    const adminOnly = ['/admin', '/integrations', '/actioned-threats'];
    if (adminOnly.some((p) => pathname.startsWith(p)) && !isAdminRole) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/overview', req.url)));
    }

    return withSecurityHeaders(NextResponse.next());
  },
  {
    callbacks: {
      authorized: ({ token }: any) => !!token,
    },
  },
);

export const config = {
  matcher: [
    '/overview/:path*',
    '/dashboard/:path*',
    '/threats/:path*',
    '/upload/:path*',
    '/admin/:path*',
    '/how-it-works/:path*',
    '/integrations/:path*',
    '/cve-database/:path*',
    '/product-portfolio/:path*',
    '/threat-feed/:path*',
    '/actioned-threats/:path*',
    '/executive-brief/:path*',
    '/policy/:path*',
    '/settings/:path*',
    '/notifications/:path*',
    '/jira-tickets/:path*',
    '/blast-radius/:path*',
    '/compliance/:path*',
  ],
};
