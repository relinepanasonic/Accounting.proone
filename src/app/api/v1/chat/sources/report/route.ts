import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as sources from '@/lib/chat/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/sources/report?days=30: leads, clients, deals and won sales per source and per channel, and the first messages with no source yet. */
export const GET = chatRoute(async ({ me, request }) => {
  const days = Math.round(Number(new URL(request.url).searchParams.get('days') || 30));
  return sources.reportData(me.workspaceId, Number.isFinite(days) && days > 0 ? days : 30);
});
