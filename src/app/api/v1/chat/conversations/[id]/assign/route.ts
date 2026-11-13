import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/assign { userId: string | null }: give the chat to a person, or to nobody. */
export const POST = chatRoute(async ({ me, id, body }) => {
  const userId = body?.userId === null || body?.userId === '' ? null : String(body?.userId ?? '');
  if (userId !== null && !/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false as const, status: 400, error: 'userId must be a person id or null.' };
  return chat.assignChat(me.workspaceId, id, userId);
}, { needsBody: true });
