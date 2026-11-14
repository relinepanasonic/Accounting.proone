import { chatRoute } from '@/lib/chat/http';
import * as meetings from '@/lib/chat/meetings';
import { afterMeeting } from '@/lib/chat/after-meeting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/v1/chat/meetings/<id> { status }: done, no_show, cancelled (cancelling also removes it from Google Calendar), or booked again.
 * A booked meeting that becomes Done or Did not come runs the after-meeting step (thank-you and the ERP lead, or new times): `after` says what happened.
 */
export const POST = chatRoute(async ({ me, id, body }) => {
  const r = await meetings.setMeetingStatus(me.workspaceId, id, body?.status);
  if (!r.ok) return r;
  const st = body?.status;
  const after = r.prev === 'booked' && (st === 'done' || st === 'no_show') ? await afterMeeting(me.workspaceId, id, st) : null;
  return { ok: true as const, after };
}, { needsBody: true });
