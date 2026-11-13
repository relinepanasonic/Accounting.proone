import { NextResponse } from 'next/server';
import { readState } from '@/lib/google/calendar';
import { finishGoogleConnect } from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/google/callback: where Google sends the person back after they allowed access to the calendar. The signed "state" says which company
 * it is for (and expires after 15 minutes); then it goes back to the chat dashboard's Jadwal page with the result.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(`${(process.env.CHAT_DASHBOARD_URL || 'https://chat.profesoronline.id').replace(/\/$/, '')}/jadwal?${q}`, { headers: { 'Cache-Control': 'no-store' } });
  const st = readState(u.searchParams.get('state'));
  if (!st) return back('google=expired');
  if (u.searchParams.get('error')) return back('google=denied');
  const code = u.searchParams.get('code');
  if (!code) return back('google=denied');
  const r = await finishGoogleConnect(st.ws, st.by, code);
  return back(r.ok ? 'google=connected' : `google=failed&reason=${encodeURIComponent(r.error.slice(0, 120))}`);
}
