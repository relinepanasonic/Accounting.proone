import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import { saveNudgeSettings } from '@/lib/chat/nudges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/meetings/nudges { enabled?, hours? }: the follow-up nudges for quiet leads. Admins only. */
export const POST = chatRoute(({ me, body }) => saveNudgeSettings(me.workspaceId, { enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined, hours: body?.hours }), { needsBody: true, roles: BIBLE_EDITORS });
