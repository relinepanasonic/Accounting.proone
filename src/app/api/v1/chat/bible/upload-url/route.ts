import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bible from '@/lib/chat/bible';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/bible/upload-url { fileName, size }: a one-time link to upload the PDF straight to the private bucket. Admins only. */
export const POST = chatRoute(({ me, body }) => bible.createUploadUrl(me.workspaceId, String(body?.fileName ?? ''), Number(body?.size ?? 0)), { needsBody: true, roles: BIBLE_EDITORS });
