import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/meetings: upcoming (and the last two days of) free consultations, the meeting settings, and the Google Calendar connection. */
export const GET = chatRoute(async ({ me }) => {
  const [list, settings, google] = await Promise.all([meetings.listMeetings(me.workspaceId), meetings.meetSettings(me.workspaceId), meetings.googleStatus(me.workspaceId)]);
  return { meetings: list, settings, google, canEdit: (BIBLE_EDITORS as readonly string[]).includes(me.role) };
});
