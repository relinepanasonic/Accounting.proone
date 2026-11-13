import { NextResponse } from 'next/server';
import { chatUser } from '@/lib/chat/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { sendReply } from '@/lib/chat/data';

export const maxDuration = 60;
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/v1/chat/conversations/<id>/send { text }: reply from the sales number. The chat goes to a person (the bot stops) and the sender is recorded. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await chatUser(request);
  if (!me) return new NextResponse(null, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Chat not found.' }, { status: 404, headers: NO_STORE });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'The body must be JSON.' }, { status: 400, headers: NO_STORE }); }
  const r = await sendReply(me.workspaceId, id, String(body?.text ?? ''), { userId: me.userId, name: me.name });
  return r.ok ? NextResponse.json({ ok: true, message: r.message }, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
}
