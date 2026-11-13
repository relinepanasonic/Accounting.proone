import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/lead { name?, title?, value?, store?, notes?, salesmanId? }: make this chat a lead in the ERP pipeline. */
export const POST = chatRoute(({ me, id, body }) => crm.createLeadFromChat(me.workspaceId, id, body || {}, me), { needsBody: true });
