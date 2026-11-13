import { chatRoute } from '@/lib/chat/http';
import * as chat from '@/lib/chat/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/conversations/<id>: the messages and notes of one chat, the bot state, who handles it, and the client and deals the ERP knows for that number. */
export const GET = chatRoute(async ({ me, id }) => (await chat.loadThread(me.workspaceId, id)) ?? { ok: false as const, status: 404, error: 'Chat not found.' });
