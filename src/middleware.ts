import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

export const config = {
  matcher: ['/', '/admin/:path*'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Land directly on the model catalog instead of the marketing homepage.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/models', req.url));
  }

  // Gate the admin panel behind a signed session cookie.
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = await verifyAdminToken(token);
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
