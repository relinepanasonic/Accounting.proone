import { chatRoute } from '@/lib/chat/http';
import * as channels from '@/lib/chat/channels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNERS = ['founder', 'superadmin'] as const;

/** GET /api/v1/chat/channels: the connected accounts (WhatsApp, Instagram, Messenger) and which Meta settings are present (never their values). */
export const GET = chatRoute(async ({ me }) => ({ ...(await channels.channelStatus(me.workspaceId)), canEdit: (OWNERS as readonly string[]).includes(me.role) }));

/** POST /api/v1/chat/channels: connect the Facebook Page and its Instagram account (read with META_PAGE_TOKEN). Owners only. */
export const POST = chatRoute(({ me }) => channels.connectMeta(me.workspaceId), { roles: OWNERS });
