import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/meetings/settings { enabled?, days?, from?, to?, minutes?, noticeHours?, daysAhead? }. Admins only. */
export const POST = chatRoute(({ me, body }) => meetings.saveMeetSettings(me.workspaceId, {
  enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined, days: Array.isArray(body?.days) ? body.days : undefined,
  from: body?.from, to: body?.to, minutes: body?.minutes, noticeHours: body?.noticeHours, daysAhead: body?.daysAhead,
  ownerId: body?.ownerId === null ? null : typeof body?.ownerId === 'string' ? body.ownerId : undefined, ownerName: typeof body?.ownerName === 'string' ? body.ownerName : undefined,
}), { needsBody: true, roles: BIBLE_EDITORS });
