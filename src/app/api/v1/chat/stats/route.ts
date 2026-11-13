import { chatRoute } from '@/lib/chat/http';
import { ALLOWED_DAYS, loadStats } from '@/lib/chat/stats-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/v1/chat/stats?days=7|30|90: reply times, the bot, each salesperson, the funnel per channel, and what is waiting now. */
export const GET = chatRoute(async ({ me, request }) => {
  const d = Number(new URL(request.url).searchParams.get('days'));
  const days = (ALLOWED_DAYS as readonly number[]).includes(d) ? d : 30;
  return { ...(await loadStats(me.workspaceId, days)) };
});
