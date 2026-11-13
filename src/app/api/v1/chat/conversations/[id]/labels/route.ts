import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/labels { labelIds: string[] }: set exactly these labels on the chat. */
export const POST = chatRoute(({ me, id, body }) => crm.setChatLabels(me.workspaceId, id, body?.labelIds), { needsBody: true });
