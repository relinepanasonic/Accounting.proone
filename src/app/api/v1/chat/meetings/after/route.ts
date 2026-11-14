import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import { saveAfterSettings } from '@/lib/chat/after-meeting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/meetings/after { thanks?, noShow? }: the messages after a consultation (thank-you when Done, new times when Did not come). Admins only. */
export const POST = chatRoute(({ me, body }) => saveAfterSettings(me.workspaceId, { thanks: body?.thanks, noShow: body?.noShow }), { needsBody: true, roles: BIBLE_EDITORS });
