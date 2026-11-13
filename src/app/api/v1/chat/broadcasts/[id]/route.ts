import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bc from '@/lib/chat/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/broadcasts/<id> { action: "pause" | "resume" | "cancel" }. Admins only. */
export const POST = chatRoute(({ me, id, body }) => bc.setBroadcastStatus(me.workspaceId, id, body?.action), { needsBody: true, roles: BIBLE_EDITORS });
