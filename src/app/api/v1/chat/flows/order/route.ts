import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/flows/order { ids }: the order flows are checked in, first to last (the first matching flow runs). Admins only. */
export const POST = chatRoute(({ me, body }) => flows.setFlowOrder(me.workspaceId, body?.ids), { needsBody: true, roles: BOD_ROLES });
