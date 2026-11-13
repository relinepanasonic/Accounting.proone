import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bible from '@/lib/chat/bible';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/bible/<id>: one document with its text. */
export const GET = chatRoute(async ({ me, id }) => (await bible.getDoc(me.workspaceId, id)) ?? { ok: false as const, status: 404, error: 'Document not found.' });

/** POST /api/v1/chat/bible/<id> { title?, text?, active? }: rename, correct the text the AI reads (a price change), or switch the document on or off. Admins only. */
export const POST = chatRoute(({ me, id, body }) => bible.saveDoc(me.workspaceId, id, { title: body?.title, text: body?.text, active: typeof body?.active === 'boolean' ? body.active : undefined }, me), { needsBody: true, roles: BIBLE_EDITORS });

/** DELETE /api/v1/chat/bible/<id>: remove the document and its file. Admins only. */
export const DELETE = chatRoute(({ me, id }) => bible.deleteDoc(me.workspaceId, id, me.name), { roles: BIBLE_EDITORS });
