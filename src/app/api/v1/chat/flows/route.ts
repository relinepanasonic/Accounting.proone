import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/flows: the scenario flows (without their drawings). */
export const GET = chatRoute(async ({ me }) => ({ flows: await flows.listFlows(me.workspaceId), canEdit: (BOD_ROLES as readonly string[]).includes(me.role) }), { roles: BOD_ROLES });

/** POST /api/v1/chat/flows { id?, name, description?, active?, graph }: create a flow, or change it when id is given. A flow with problems can be saved switched off, never on. Admins only. */
export const POST = chatRoute(({ me, body }) => flows.saveFlow(me.workspaceId, { id: body?.id ? String(body.id) : undefined, name: body?.name, description: body?.description, active: body?.active, graph: body?.graph }, me), { needsBody: true, roles: BOD_ROLES });
