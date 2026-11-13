import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bible from '@/lib/chat/bible';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const maxDuration = 120;

/** POST /api/v1/chat/bible/ingest { path, title, replaces? }: the PDF was uploaded; Claude reads it and the text is saved. With `replaces` the old version is switched off. Admins only. */
export const POST = chatRoute(({ me, body }) => bible.ingestDeck(me.workspaceId, { path: String(body?.path ?? ''), title: String(body?.title ?? ''), replaces: body?.replaces ? String(body.replaces) : null }, me), { needsBody: true, roles: BIBLE_EDITORS });
