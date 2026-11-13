import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/chat/labels/<id>: remove a label from every chat. Admins only. */
export const DELETE = chatRoute(({ me, id }) => crm.deleteLabel(me.workspaceId, id), { roles: BIBLE_EDITORS });
