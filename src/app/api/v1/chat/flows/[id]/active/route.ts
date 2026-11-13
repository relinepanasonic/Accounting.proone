import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/flows/<id>/active { active: boolean }: switch a flow on or off. A flow with problems cannot be switched on. Admins only. */
export const POST = chatRoute(({ me, id, body }) => flows.setFlowActive(me.workspaceId, id, body?.active === true, me), { needsBody: true, roles: BIBLE_EDITORS });
