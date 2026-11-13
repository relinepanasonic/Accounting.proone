import { NextResponse } from 'next/server';
import { chatUser } from '@/lib/chat/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { setChatStatus } from '@/lib/chat/data';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/v1/chat/conversations/<id>/status { status: "bot" | "human" | "off" }: give the chat to the bot, take it, or switch the bot off for it. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await chatUser(request);
  if (!me) return new NextResponse(null, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Chat not found.' }, { status: 404, headers: NO_STORE });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'The body must be JSON.' }, { status: 400, headers: NO_STORE }); }
  if (!['bot', 'human', 'off'].includes(body?.status)) return NextResponse.json({ error: 'status must be bot, human or off.' }, { status: 400, headers: NO_STORE });
  const r = await setChatStatus(me.workspaceId, id, body.status, me.name);
  return r.ok ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
}
