import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/ignore { ignored: true | false }: mark the chat "not a lead" (the bot stays quiet, no lead, out of the numbers), or give it back. */
export const POST = chatRoute(({ me, id, body }) => chat.setChatIgnored(me.workspaceId, id, body?.ignored !== false, `Marked "not a lead" by ${me.name}.`), { needsBody: true });
