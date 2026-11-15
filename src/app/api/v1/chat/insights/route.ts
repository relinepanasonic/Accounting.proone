import { chatRoute } from '@/lib/chat/http';
import { INSIGHT_DAYS, loadInsights } from '@/lib/chat/insights-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/v1/chat/insights?days=7|30|90: which packages clients ask about, what worries them, what they say they need. Counted from the chats. */
export const GET = chatRoute(async ({ me, request }) => {
  const d = Number(new URL(request.url).searchParams.get('days'));
  return { ...(await loadInsights(me.workspaceId, (INSIGHT_DAYS as readonly number[]).includes(d) ? d : 30)) };
});
