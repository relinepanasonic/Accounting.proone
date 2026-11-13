import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/notes { text }: an internal note, shown in the chat to the team only. Never sent to the lead. */
export const POST = chatRoute(({ me, id, body }) => chat.addNote(me.workspaceId, id, String(body?.text ?? ''), me), { needsBody: true });
