import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/resolve { resolved: boolean }: close or reopen a chat. A new message from the lead reopens it by itself. */
export const POST = chatRoute(({ me, id, body }) => chat.resolveChat(me.workspaceId, id, body?.resolved !== false, me), { needsBody: true });
