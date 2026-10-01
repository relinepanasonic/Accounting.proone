import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { withSharedCookieOptions } from '@/lib/supabase/cookie-options';

export const dynamic = 'force-dynamic';

/**
 * Enters a workspace from the landing page: checks the user may enter it, remembers it as the active
 * workspace, and marks this browser session as "has chosen" so the landing page is not shown again until
 * the browser is closed or the user signs out.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedWorkspaceContext();
  if (!ctx.userId) return NextResponse.redirect(new URL('/login', request.url));

  const id = request.nextUrl.searchParams.get('id') || '';
  // Only workspaces this user is a member of (founders: all). Anything else goes back to the picker.
  if (!ctx.availableWorkspaces.some((w) => w.id === id)) {
    return NextResponse.redirect(new URL('/workspaces', request.url));
  }

  const res = NextResponse.redirect(new URL('/', request.url));
  res.cookies.set('active_workspace_id', id, withSharedCookieOptions({ maxAge: 60 * 60 * 24 * 365 }));
  // Session cookie (no maxAge): gone when the browser closes. The value is the user id so another
  // account signing in on the same browser is asked to choose again.
  res.cookies.set('workspace_chosen', ctx.userId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
