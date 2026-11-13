import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as flows from '@/lib/chat/flows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/flows/test { graph, context }: what the drawing WOULD do for a sample message. Nothing is sent or saved. */
export const POST = chatRoute(async ({ body }) => flows.testFlow(body?.graph, body?.context && typeof body.context === 'object' ? body.context : {}), { needsBody: true });
