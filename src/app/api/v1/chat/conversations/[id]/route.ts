import { NextResponse } from 'next/server';
import { chatUser } from '@/lib/chat/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { loadThread } from '@/lib/chat/data';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/v1/chat/conversations/<id>: the messages of one chat, the bot state, and the client and deals the ERP knows for that number. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await chatUser(request);
  if (!me) return new NextResponse(null, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Chat not found.' }, { status: 404, headers: NO_STORE });
  try {
    const t = await loadThread(me.workspaceId, id);
    return t ? NextResponse.json(t, { headers: NO_STORE }) : NextResponse.json({ error: 'Chat not found.' }, { status: 404, headers: NO_STORE });
  } catch (e: any) {
    console.error('chat thread failed', e);
    return NextResponse.json({ error: 'Could not load the chat.' }, { status: 500, headers: NO_STORE });
  }
}
