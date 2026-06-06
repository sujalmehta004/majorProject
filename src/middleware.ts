import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and auth page exemptions
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/subscription-expired' ||
    pathname === '/' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Exempt superadmin matrix-dashboard from password/auth checks for Sprint 1 testing
  if (pathname === '/superadmin/matrix-dashboard') {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('medhub_session');

  if (!sessionCookie) {
    // Redirect unauthenticated access to protected dashboards to login page with return URL
    if (
      pathname.startsWith('/wholesaler') ||
      pathname.startsWith('/retailer') ||
      pathname.startsWith('/superadmin')
    ) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  try {
    // Decode JWT payload without node-jsonwebtoken in the Edge Middleware
    const token = sessionCookie.value;
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT structure');
    }
    
    // Decode base64url payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);

    // Subscription check: If expired, deactivate user, clear session, and redirect to 403 Forbidden
    const now = new Date().getTime();
    const expiryTime = new Date(payload.subscriptionEnd).getTime();

    if (now > expiryTime) {
      // Trigger database deactivation API in the background
      try {
        await fetch(new URL('/api/auth/expire-subscription', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: payload.userId }),
        });
      } catch (err) {
        console.error('Failed to report expired subscription in middleware:', err);
      }

      // Clear cookie and redirect
      const response = NextResponse.redirect(new URL('/subscription-expired', request.url));
      response.cookies.delete('medhub_session');
      return response;
    }

    // Role Guard validation
    if (
      pathname.startsWith('/wholesaler') &&
      payload.role !== 'WHOLESALER' &&
      payload.role !== 'WHOLESALER_STAFF'
    ) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (pathname.startsWith('/retailer') && payload.role !== 'RETAILER') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (pathname.startsWith('/superadmin') && payload.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware JWT parsing failed:', error);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('medhub_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
