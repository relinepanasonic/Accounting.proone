import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bc from '@/lib/chat/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/broadcasts/settings { dailyMax?, from?, to?, gapMin?, gapMax? }: what protects the number. Admins only. */
export const POST = chatRoute(({ me, body }) => bc.saveBcSettings(me.workspaceId, { dailyMax: body?.dailyMax, from: body?.from, to: body?.to, gapMin: body?.gapMin, gapMax: body?.gapMax }), { needsBody: true, roles: BIBLE_EDITORS });
