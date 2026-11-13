import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bible from '@/lib/chat/bible';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/bible: the AI Kamus documents, their history (without their text), the bot's settings, and whether this person may change them. */
export const GET = chatRoute(async ({ me }) => ({
  docs: await bible.listDocs(me.workspaceId),
  log: await bible.listLog(me.workspaceId),
  settings: await bible.getSettings(me.workspaceId),
  canEdit: (BIBLE_EDITORS as readonly string[]).includes(me.role),
}));
