import { chatRoute } from '@/lib/chat/http';
import { BIBLE_EDITORS } from '@/lib/chat/auth';
import * as bible from '@/lib/chat/bible';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/chat/bible/settings { enabled?, persona_name?, company_name?, hours_from?, hours_to?, max_replies?, knowledge?, social_script? }: the bot's switch, name, hours, the WhatsApp script and the Instagram & Messenger script. Admins only. */
export const POST = chatRoute(({ me, body }) => bible.saveSettings(me.workspaceId, {
  enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined, media_enabled: typeof body?.media_enabled === 'boolean' ? body.media_enabled : undefined, persona_name: body?.persona_name, company_name: body?.company_name,
  hours_from: body?.hours_from, hours_to: body?.hours_to, max_replies: body?.max_replies, knowledge: typeof body?.knowledge === 'string' ? body.knowledge : undefined,
  social_script: typeof body?.social_script === 'string' ? body.social_script : undefined,
}, me), { needsBody: true, roles: BIBLE_EDITORS });
