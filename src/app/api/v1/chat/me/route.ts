import { chatRoute } from '@/lib/chat/http';
import { BOD_ROLES } from '@/lib/chat/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/me: who is signed in to the chat dashboard, and whether they are the BOD (founder or superadmin). */
export const GET = chatRoute(async ({ me }) => ({ id: me.userId, name: me.name, role: me.role, isBod: (BOD_ROLES as readonly string[]).includes(me.role) }));
