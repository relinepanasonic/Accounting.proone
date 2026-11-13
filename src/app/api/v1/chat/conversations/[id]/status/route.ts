import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/status { status: "bot" | "human" | "off" }: give the chat to the bot, take it (it becomes yours), or switch the bot off for it. */
export const POST = chatRoute(async ({ me, id, body }) => {
  if (!['bot', 'human', 'off'].includes(body?.status)) return { ok: false as const, status: 400, error: 'status must be bot, human or off.' };
  return chat.setChatStatus(me.workspaceId, id, body.status, me);
}, { needsBody: true });
