import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bible from '@/lib/chat/bible';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/** POST /api/v1/chat/bible/ask { question }: ask the AI what it knows (from the script and the documents). Nothing is stored or sent. */
export const POST = chatRoute(({ me, body }) => bible.askBible(me.workspaceId, String(body?.question ?? '')), { needsBody: true });
