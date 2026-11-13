import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/** POST /api/v1/chat/conversations/<id>/send { text }: reply from the sales number. The chat goes to a person (the bot stops), the sender is recorded and takes the chat if it was free. */
export const POST = chatRoute(({ me, id, body }) => chat.sendReply(me.workspaceId, id, String(body?.text ?? ''), me), { needsBody: true });
