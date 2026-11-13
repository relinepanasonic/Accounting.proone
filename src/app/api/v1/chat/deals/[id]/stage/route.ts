import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/deals/<id>/stage { stage }: Lead, Contacted, Negotiation or Cold Case (the ERP's own rule: a salesperson moves only their deals). */
export const POST = chatRoute(({ me, id, body }) => crm.moveDealStage(me.workspaceId, id, body?.stage, me), { needsBody: true });
