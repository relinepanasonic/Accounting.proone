import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as sources from '@/lib/chat/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/sources: the ads (sources) and the message each pre-fills. */
export const GET = chatRoute(async ({ me }) => ({ sources: await sources.listSources(me.workspaceId), canEdit: (BIBLE_EDITORS as readonly string[]).includes(me.role) }));

/** POST /api/v1/chat/sources { id?, name, channel, first_message, active? }: add a source, or change it when id is given. Admins only. */
export const POST = chatRoute(({ me, body }) => sources.saveSource(me.workspaceId, { id: body?.id ? String(body.id) : undefined, name: body?.name, channel: body?.channel, first_message: body?.first_message, active: body?.active }, me), { needsBody: true, roles: BIBLE_EDITORS });
