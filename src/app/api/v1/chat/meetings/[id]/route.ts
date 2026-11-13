import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/meetings/<id> { status }: done, no_show, cancelled (cancelling also removes it from Google Calendar), or booked again. */
export const POST = chatRoute(({ me, id, body }) => meetings.setMeetingStatus(me.workspaceId, id, body?.status), { needsBody: true });
