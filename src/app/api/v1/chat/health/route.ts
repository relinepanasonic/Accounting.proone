import { chatRoute } from '@/lib/chat/http';
import { loadHealth } from '@/lib/chat/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/health: is the sales WhatsApp number delivering messages? { ok, reason, text, silentHours, deviceStatus, lastIncomingAt } */
export const GET = chatRoute(async ({ me }) => ({ ...(await loadHealth(me.workspaceId)) }));
