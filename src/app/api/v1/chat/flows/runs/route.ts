import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/flows/runs: what the flows did lately, newest first. */
export const GET = chatRoute(async ({ me }) => ({ runs: await flows.listRuns(me.workspaceId) }), { roles: BOD_ROLES });
