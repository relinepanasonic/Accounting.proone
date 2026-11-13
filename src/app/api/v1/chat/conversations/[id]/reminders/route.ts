import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/reminders { dueAt, note?, assignTo? }: a follow-up reminder on this chat (also a task in the ERP planner). */
export const POST = chatRoute(({ me, id, body }) => crm.addReminder(me.workspaceId, id, { dueAt: body?.dueAt, note: body?.note, assignTo: body?.assignTo }, me), { needsBody: true });
