import { chatRoute } from '@/lib/chat/http';
import { INSIGHT_DAYS, loadSummary } from '@/lib/chat/insights-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/v1/chat/insights/summary { days, fresh? }: a short summary for the BOD written by the AI from the counts (kept 6 hours; fresh = write it again). */
export const POST = chatRoute(async ({ me, body }) => {
  const d = Number(body?.days);
  const days = (INSIGHT_DAYS as readonly number[]).includes(d) ? d : 30;
  try { return { ...(await loadSummary(me.workspaceId, days, body?.fresh === true)), days }; }
  catch (e: any) { return { ok: false as const, status: 502, error: `The AI could not write the summary: ${String(e?.message || e).slice(0, 140)}` }; }
}, { needsBody: true });
