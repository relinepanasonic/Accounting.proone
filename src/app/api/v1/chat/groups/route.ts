import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import { listSalesGroups, setGroupActive } from '@/lib/chat/group-consultant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/groups: the groups the sales number is in, whether Fefe answers there, and how many answers today and in all (BOD only). */
export const GET = chatRoute(({ me }) => listSalesGroups(me.workspaceId), { roles: BOD_ROLES });
/** POST /api/v1/chat/groups { id, active }: switch Fefe on or off in one group (BOD only). */
export const POST = chatRoute(({ me, body }) => setGroupActive(me.workspaceId, String(body?.id ?? ''), body?.active === true), { needsBody: true, roles: BOD_ROLES });
