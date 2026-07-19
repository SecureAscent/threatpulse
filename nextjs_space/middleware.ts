import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/rbac';

export default withAuth(
  function middleware(req: any) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token;
    const role = token?.role;

    if (pathname.startsWith('/admin') && !hasPermission(role, 'users.manage')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    if (pathname.startsWith('/integrations') && !hasPermission(role, 'integrations.manage')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    if (pathname.startsWith('/actioned-threats') && !hasPermission(role, 'threats.manage')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }: any) => !!token && !token.accessRevoked,
    },
  }
);

export const config = {
  matcher: [
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
  ],
};
