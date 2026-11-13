import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/meetings/google: the Google sign-in link to connect the team's calendar. DELETE: disconnect it. Admins only. */
export const POST = chatRoute(async ({ me }) => meetings.googleConnectUrl(me.workspaceId, me.name), { roles: BIBLE_EDITORS });
export const DELETE = chatRoute(({ me }) => meetings.disconnectGoogle(me.workspaceId), { roles: BIBLE_EDITORS });
