import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/flows/examples: create the four suggested flows (switched off). Admins only. */
export const POST = chatRoute(({ me }) => flows.createExamples(me.workspaceId, me), { roles: BOD_ROLES });
