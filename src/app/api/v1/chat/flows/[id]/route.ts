import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/flows/<id>: one flow with its drawing. */
export const GET = chatRoute(async ({ me, id }) => (await flows.getFlow(me.workspaceId, id)) ?? { ok: false as const, status: 404, error: 'Flow not found.' });

/** DELETE /api/v1/chat/flows/<id>. Admins only. */
export const DELETE = chatRoute(({ me, id }) => flows.deleteFlow(me.workspaceId, id), { roles: BIBLE_EDITORS });
