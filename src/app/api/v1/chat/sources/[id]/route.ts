import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as sources from '@/lib/chat/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/chat/sources/<id>: remove a source (chats keep the name it had). Admins only. */
export const DELETE = chatRoute(({ me, id }) => sources.deleteSource(me.workspaceId, id), { roles: BIBLE_EDITORS });
