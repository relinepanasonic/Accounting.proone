import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sharedCookieOptions } from '@/lib/supabase/cookie-options';
import { isFounderEmail } from '@/lib/auth/founders';

// advertiser / client roles may open ONLY these areas. Every finance route is closed to them.
const LIMITED_ROLE_HOME = '/productivity/pabrik-sosmed/dashboard';
const LIMITED_ROLE_ALLOWED = ['/productivity/pabrik-sosmed', '/no-access', '/workspaces'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // /api/admin/* are one-off maintenance routes that use the service role: never public.
  const isAdminApi = pathname.startsWith('/api/admin') || pathname.startsWith('/api/test-db');

  // Public paths that don't require authentication
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/set-password') ||
    pathname.startsWith('/auth/') ||
    (pathname.startsWith('/api/') && !isAdminApi);

  if (!user && !isPublicPath) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/register
  if (user && (pathname === '/login' || pathname === '/register')) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/';
    return NextResponse.redirect(dashboardUrl);
  }

  // Role gate (optimistic check; RLS and server actions enforce the same rules).
  if (user && !isPublicPath) {
    let role: string;
    if (isFounderEmail(user.email)) {
      role = 'founder';
    } else {
      const filters = [`user_id.eq.${user.id}`];
      if (user.email) filters.push(`email.ilike.${user.email.trim().replace(/[,()]/g, '')}`);
      const { data: rows } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .or(filters.join(','));
      const activeWorkspaceId = request.cookies.get('active_workspace_id')?.value;
      const row = rows?.find((r) => r.workspace_id === activeWorkspaceId) || rows?.[0];
      role = row?.role || 'none';
    }

    const redirectTo = (path: string) => {
      const url = request.nextUrl.clone();
      url.pathname = path;
      url.search = '';
      return NextResponse.redirect(url);
    };

    if (role === 'none' && pathname !== '/no-access') {
      return pathname.startsWith('/api/') ? NextResponse.json({ error: 'Forbidden' }, { status: 403 }) : redirectTo('/no-access');
    }

    // Landing page: once per browser session, choose which workspace to enter. The cookie holds the user id,
    // so a different account on the same browser is asked again.
    const isPage = request.method === 'GET' && !pathname.startsWith('/api/');
    const onLanding = pathname === '/workspaces' || pathname.startsWith('/workspaces/') || pathname === '/no-access';
    if (isPage && !onLanding && request.cookies.get('workspace_chosen')?.value !== user.id) {
      return redirectTo('/workspaces');
    }

    if (isAdminApi && role !== 'founder' && role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if ((role === 'advertiser' || role === 'client') && !pathname.startsWith('/api/')) {
      const allowed = LIMITED_ROLE_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'));
      if (!allowed) return redirectTo(LIMITED_ROLE_HOME);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
