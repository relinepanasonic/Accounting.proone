import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import { groupLog } from '@/lib/chat/group-consultant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/groups/<id>/log: what Fefe saw and said in one group (BOD only). */
export const GET = chatRoute(({ me, id }) => groupLog(me.workspaceId, id), { roles: BOD_ROLES });
