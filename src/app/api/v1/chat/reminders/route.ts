import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/reminders?scope=mine|all: open follow-ups, soonest first. */
export const GET = chatRoute(async ({ me, request }) => ({ reminders: await crm.listReminders(me.workspaceId, me, new URL(request.url).searchParams.get('scope') === 'all' ? 'all' : 'mine') }));
