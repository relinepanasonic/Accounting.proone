import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import type { ChatFilter } from '@/lib/chat/shape';
import { PIPELINE_STAGES } from '@/lib/sales/flow';

/** GET /api/v1/chat/conversations?filter=all|mine|unserved|bot|human|resolved&q=&label=&stage=: the sales number's private chats, newest first. stage = a pipeline stage (stored name) or none. */
export const GET = chatRoute(async ({ me, request }) => {
  const url = new URL(request.url);
  const f = url.searchParams.get('filter');
  const filter: ChatFilter = f === 'mine' || f === 'unserved' || f === 'bot' || f === 'human' || f === 'resolved' || f === 'followup' ? f : 'all';
  const label = (url.searchParams.get('label') || '').slice(0, 40);
  const rawStage = url.searchParams.get('stage') || '';
  const stage = rawStage === 'none' || (PIPELINE_STAGES as readonly string[]).includes(rawStage) ? rawStage : '';
  return { me: { id: me.userId, name: me.name, role: me.role }, ...(await chat.listConversations(me.workspaceId, filter, (url.searchParams.get('q') || '').slice(0, 80), me.userId, /^[0-9a-f-]{36}$/i.test(label) ? label : '', stage)) };
});
