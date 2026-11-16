import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import { saveTeam, teamOverview } from '@/lib/chat/sales-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/team: everyone in the company and who is in the sales team. POST { people: [{ id, name }] }: save the sales team (BOD only). */
export const GET = chatRoute(async ({ me }) => teamOverview(me.workspaceId), { roles: BOD_ROLES });
export const POST = chatRoute(({ me, body }) => saveTeam(me.workspaceId, body?.people), { needsBody: true, roles: BOD_ROLES });
