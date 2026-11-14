import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as meetings from '@/lib/chat/meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/meetings/slots: the free times right now (up to 400), to book from the inbox. */
export const GET = chatRoute(async ({ me }) => ({ slots: (await meetings.availableSlots(me.workspaceId)).slice(0, 400).map((d) => ({ code: d.toISOString(), label: meetings.slotLabel(d) })) }));
