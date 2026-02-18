import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/register'];
const PROTECTED_ROUTES = ['/chat', '/invite'];

const API_BASE = process.env.API_URL || 'http://localhost:8787';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  let isAuthenticated = !!sessionCookie?.value;

  // Check if route is protected (starts with /chat)
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Check if route is auth route (login/register)
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  // Validate session against the API when it matters
  if (isAuthenticated && (isAuthRoute || isProtectedRoute)) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Cookie: `session=${sessionCookie!.value}` },
      });
      if (!res.ok) {
        isAuthenticated = false;
      }
    } catch {
      // API unreachable -- treat as unauthenticated to avoid redirect loops
      isAuthenticated = false;
    }
  }

  // Clear stale cookie if session is invalid
  if (!isAuthenticated && sessionCookie?.value) {
    const response = isProtectedRoute
      ? NextResponse.redirect(new URL(`/login?redirect=${pathname}`, request.url))
      : NextResponse.next();
    response.cookies.delete('session');
    return response;
  }

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth routes to chat
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled by server)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
