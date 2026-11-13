import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/** POST /api/v1/chat/conversations/<id>/suggest: an AI-written draft reply from the bot's knowledge. Nothing is sent: the person edits it and sends. */
export const POST = chatRoute(({ me, id }) => chat.suggestReply(me.workspaceId, id, me));
