import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/v1/chat/pipeline: the pipeline board (every open deal, Active Clients and Lost of the last 30 days) with the chat of each. Moving a card uses POST /deals/<id>/stage. */
export const GET = chatRoute(async ({ me }) => ({ ...(await chat.loadPipeline(me.workspaceId)), me: { id: me.userId, name: me.name, role: me.role } }));
