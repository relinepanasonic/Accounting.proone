import { chatRoute } from '@/lib/chat/http';
import * as channels from '@/lib/chat/channels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/channels/<id> { active }: switch an Instagram or Messenger account off (its chats stay) or on. Owners only. */
export const POST = chatRoute(({ me, id, body }) => channels.setChannelActive(me.workspaceId, id, body?.active === true), { needsBody: true, roles: ['founder', 'superadmin'] });
