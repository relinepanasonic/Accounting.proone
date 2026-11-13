import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as sources from '@/lib/chat/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 120;

/** POST /api/v1/chat/sources/rescan: look at every chat again (record first messages, match them to the current sources). Admins only. */
export const POST = chatRoute(({ me }) => sources.rescanSources(me.workspaceId), { roles: BIBLE_EDITORS });
