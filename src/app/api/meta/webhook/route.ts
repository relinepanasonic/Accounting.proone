import { NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { ingestMessage } from '@/lib/wa/ingest';
import { afterSalesMessage } from '@/lib/chat/inbound';
import { isOwnEcho, parseMetaWebhook, toParsed, validSignature, type MetaEvent } from '@/lib/meta/parse';
import { metaProfileName } from '@/lib/meta/send';
import { metaChatId } from '@/lib/chat/channel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/meta/webhook: Meta checks the URL once when the webhook is set up (hub.verify_token must equal META_VERIFY_TOKEN).
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const ok = u.searchParams.get('hub.mode') === 'subscribe' && !!process.env.META_VERIFY_TOKEN && u.searchParams.get('hub.verify_token') === process.env.META_VERIFY_TOKEN;
  return ok ? new NextResponse(u.searchParams.get('hub.challenge') || '', { status: 200, headers: { ...NO_STORE, 'Content-Type': 'text/plain' } }) : new NextResponse('Forbidden', { status: 403, headers: NO_STORE });
}

type Device = { id: string; workspace_id: string; phone: string; role: string };

/**
 * POST /api/meta/webhook: messages to our Facebook Page and Instagram account. Signed by Meta with the app secret: anything unsigned gets 401.
 * Each message is saved like a WhatsApp one (chat id "ig:<id>" / "fb:<id>", on the device row of the account it was sent to), then the
 * same steps run (source, flows, bot). Answers 200 fast; 500 only when saving failed, so Meta sends it again.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) return NextResponse.json({ error: 'Bad signature.' }, { status: 401, headers: NO_STORE });
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true, ignored: 'not json' }, { headers: NO_STORE }); }

  const events = parseMetaWebhook(body).filter((e) => !isOwnEcho(e, process.env.META_APP_ID));
  if (!events.length) return NextResponse.json({ ok: true, events: 0 }, { headers: NO_STORE });

  const db = createAdminClient();
  const devices = new Map<string, Device | null>();
  const deviceFor = async (e: MetaEvent) => {
    const phone = metaChatId(e.channel, e.accountId);
    if (!devices.has(phone)) {
      const { data } = await db.from('wa_devices').select('id, workspace_id, phone, role').eq('phone', phone).eq('active', true).limit(1).maybeSingle();
      devices.set(phone, (data as Device | null) ?? null);
    }
    return devices.get(phone) ?? null;
  };

  let saved = 0;
  try {
    for (const e of events) {
      const device = await deviceFor(e);
      if (!device) { console.warn('meta webhook: no connected account', e.channel, e.accountId); continue; }
      // a new chat gets the person's name from Meta, once
      let name: string | null = null;
      const chatId = metaChatId(e.channel, e.userId);
      const { data: g } = await db.from('wa_groups').select('name').eq('workspace_id', device.workspace_id).eq('wa_id', chatId).maybeSingle();
      if (!(g as any)?.name && process.env.META_PAGE_TOKEN) name = await metaProfileName(e.channel, e.userId, process.env.META_PAGE_TOKEN);
      const parsed = toParsed(e, device.phone, name ?? ((g as any)?.name || null));
      const res = await ingestMessage(device, parsed, body);
      if (res.stored) saved++;
      if (res.stored && res.isNew) after(() => afterSalesMessage(device, parsed, res));
    }
  } catch (err) {
    console.error('meta webhook failed', err);
    return NextResponse.json({ ok: false, error: 'save failed' }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, events: events.length, saved }, { headers: NO_STORE });
}
