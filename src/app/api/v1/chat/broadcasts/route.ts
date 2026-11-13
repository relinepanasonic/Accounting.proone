import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bc from '@/lib/chat/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/broadcasts: the broadcasts with their progress, today's count against the daily maximum, the settings, and who would get a new one. */
export const GET = chatRoute(async ({ me }) => ({ ...(await bc.listBroadcasts(me.workspaceId)), canEdit: (BIBLE_EDITORS as readonly string[]).includes(me.role) }));

/** POST /api/v1/chat/broadcasts { name, message }: queue a broadcast to every past WhatsApp lead (except STOP). It is sent one by one by the clock. Admins only. */
export const POST = chatRoute(({ me, body }) => bc.createBroadcast(me.workspaceId, { name: body?.name, message: body?.message }, me.name), { needsBody: true, roles: BIBLE_EDITORS });
