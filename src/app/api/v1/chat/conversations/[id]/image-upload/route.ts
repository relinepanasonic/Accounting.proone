import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as crm from '@/lib/chat/crm-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/conversations/<id>/image-upload { fileName, size, type }: a one-time link to upload a picture for this chat. */
export const POST = chatRoute(({ me, id, body }) => crm.createImageUploadUrl(me.workspaceId, id, String(body?.fileName ?? ''), Number(body?.size ?? 0), String(body?.type ?? '')), { needsBody: true });
