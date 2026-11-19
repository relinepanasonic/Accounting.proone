import { chatRoute } from '@/lib/chat/http';
import { startChat } from '@/lib/chat/new-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/v1/chat/conversations/start { phone, text }: write the first message to a number, from the sales number. The chat is made and kept, so it is in the inbox
 * from the first message (a message typed by hand on the phone is never seen by this system). A daily limit protects the number.
 */
export const POST = chatRoute(({ me, body }) => startChat(me.workspaceId, body, { userId: me.userId, name: me.name }), { needsBody: true });
