import { NextResponse } from 'next/server';
import { chatUser } from '@/lib/chat/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { listConversations } from '@/lib/chat/data';
import type { ChatFilter } from '@/lib/chat/shape';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** GET /api/v1/chat/conversations?filter=all|unserved|bot|human&q=: the sales number's private chats, newest first. Bearer: the person's ERP access token. */
export async function GET(request: Request) {
  const me = await chatUser(request);
  if (!me) return new NextResponse(null, { status: 401, headers: NO_STORE });
  const url = new URL(request.url);
  const f = url.searchParams.get('filter');
  const filter: ChatFilter = f === 'unserved' || f === 'bot' || f === 'human' ? f : 'all';
  try {
    return NextResponse.json({ me: { name: me.name, role: me.role }, ...(await listConversations(me.workspaceId, filter, (url.searchParams.get('q') || '').slice(0, 80))) }, { headers: NO_STORE });
  } catch (e: any) {
    console.error('chat list failed', e);
    return NextResponse.json({ error: 'Could not load the chats.' }, { status: 500, headers: NO_STORE });
  }
}
