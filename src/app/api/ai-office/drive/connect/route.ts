import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { authUrl, driveEnvReady } from '@/lib/ai/drive';

export const dynamic = 'force-dynamic';

/** Starts the Google sign-in for the Studio (opens Google, comes back to /callback). */
export async function GET(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!driveEnvReady()) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.' }, { status: 400 });

  const origin = new URL(request.url).origin;
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set('drive_oauth_state', state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
