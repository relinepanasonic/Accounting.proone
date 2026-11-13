import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/reminders/<id>/done { done: boolean }: mark a follow-up done (or open again). The ERP task follows. */
export const POST = chatRoute(({ me, id, body }) => crm.setReminderDone(me.workspaceId, id, body?.done !== false, me), { needsBody: true });
