import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';
import { nudgeSummary } from '@/lib/chat/nudges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/meetings: upcoming (and the last two days of) free consultations, the meeting settings, the Google Calendar connection, and the follow-up nudges. */
export const GET = chatRoute(async ({ me }) => {
  const [list, settings, google, nudges] = await Promise.all([meetings.listMeetings(me.workspaceId), meetings.meetSettings(me.workspaceId), meetings.googleStatus(me.workspaceId), nudgeSummary(me.workspaceId).catch(() => null)]);
  return { meetings: list, settings, google, nudges, canEdit: (BIBLE_EDITORS as readonly string[]).includes(me.role) };
});
