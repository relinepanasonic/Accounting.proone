import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/** POST /api/v1/chat/conversations/<id>/meeting { start }: the team books a free consultation for this chat; the lead gets the time and Meet link. */
export const POST = chatRoute(({ me, id, body }) => meetings.bookFromInbox(me.workspaceId, id, body?.start, { name: me.name, userId: me.userId }), { needsBody: true });
