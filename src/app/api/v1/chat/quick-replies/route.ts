import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/quick-replies: the shared quick replies (typed as /shortcut in the dashboard). */
export const GET = chatRoute(async ({ me }) => ({ quickReplies: await chat.listQuickReplies(me.workspaceId) }));

/** POST /api/v1/chat/quick-replies { id?, shortcut, title, body }: create one, or change it when id is given. */
export const POST = chatRoute(({ me, body }) => chat.saveQuickReply(me.workspaceId, { id: body?.id ? String(body.id) : undefined, shortcut: String(body?.shortcut ?? ''), title: String(body?.title ?? ''), body: String(body?.body ?? '') }, me), { needsBody: true });
