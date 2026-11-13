import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/agents: the people a chat can be assigned to. */
export const GET = chatRoute(async ({ me }) => ({ agents: await chat.listAgents(me.workspaceId) }));
