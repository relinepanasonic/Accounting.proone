// Cookies shared between accounting.profesoronline.id and digitalads.profesoronline.id.
// Opt-in: set COOKIE_DOMAIN=.profesoronline.id (server) and NEXT_PUBLIC_COOKIE_DOMAIN=.profesoronline.id (browser)
// in production only. Left unset (localhost, Vercel previews) cookies stay host-only so login keeps working there.
const domain = process.env.COOKIE_DOMAIN || process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

export const sharedCookieOptions = domain
  ? { domain, secure: true, sameSite: 'lax' as const, path: '/' }
  : { sameSite: 'lax' as const, path: '/' };

/** Merge Supabase's per-cookie options with the shared domain settings. */
export function withSharedCookieOptions<T extends object>(options?: T) {
  return { ...(options || {}), ...sharedCookieOptions };
}
