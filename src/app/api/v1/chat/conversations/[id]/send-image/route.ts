import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/** POST /api/v1/chat/conversations/<id>/send-image { path, caption? }: send the uploaded picture from the sales number. */
export const POST = chatRoute(({ me, id, body }) => crm.sendChatImage(me.workspaceId, id, { path: body?.path, caption: body?.caption }, me), { needsBody: true });
