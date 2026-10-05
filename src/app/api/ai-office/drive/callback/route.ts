import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { exchangeCode } from '@/lib/ai/drive';

export const dynamic = 'force-dynamic';

/** Google sends the owner back here with a code. The refresh token is stored on the server, never shown. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (msg: string) => NextResponse.redirect(`${url.origin}/ai-office?tab=studio&drive=${encodeURIComponent(msg)}`);

  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cookie = request.headers.get('cookie') || '';
  const expected = /(?:^|;\s*)drive_oauth_state=([^;]+)/.exec(cookie)?.[1];
  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code');
  if (!code || !expected || url.searchParams.get('state') !== expected) return back('state-mismatch');

  try {
    const t = await exchangeCode(url.origin, code);
    const { error } = await access.supabase
      .from('ai_integrations')
      .upsert({ workspace_id: access.workspaceId, provider: 'google_drive', account_email: t.email, refresh_token: t.refreshToken, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,provider' });
    if (error) return back('tables-missing');
    const res = back('connected');
    res.cookies.delete('drive_oauth_state');
    return res;
  } catch (err: any) {
    return back(String(err?.message || 'failed').slice(0, 120));
  }
}
