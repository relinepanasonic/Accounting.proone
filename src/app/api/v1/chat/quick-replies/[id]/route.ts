import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/chat/quick-replies/<id> */
export const DELETE = chatRoute(({ me, id }) => chat.deleteQuickReply(me.workspaceId, id));
