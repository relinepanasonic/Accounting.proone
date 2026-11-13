import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/labels: the labels a chat can get. */
export const GET = chatRoute(async ({ me }) => ({ labels: await crm.listLabels(me.workspaceId) }));

/** POST /api/v1/chat/labels { id?, name, color }: add a label, or change it. Anyone on the team. */
export const POST = chatRoute(({ me, body }) => crm.saveLabel(me.workspaceId, { id: body?.id ? String(body.id) : undefined, name: body?.name, color: body?.color }, me), { needsBody: true });
