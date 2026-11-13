import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as sources from '@/lib/chat/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/source { sourceId: string | null }: say where this lead came from (null clears it). */
export const POST = chatRoute(({ me, id, body }) => sources.setChatSource(me.workspaceId, id, body?.sourceId ? String(body.sourceId) : null, me), { needsBody: true });
