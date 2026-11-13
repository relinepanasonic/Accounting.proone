import { NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { parseFonnteWebhook, readWebhookPayload } from '@/lib/wa/parse-webhook';
import { deviceBySecret, ingestMessage } from '@/lib/wa/ingest';
import { runSalesBot } from '@/lib/wa/bot/run';
import { captureLeadSource } from '@/lib/chat/sources';
import { runFlowsFor } from '@/lib/chat/flows';

export const dynamic = 'force-dynamic';
// The sales bot runs after the answer to Fonnte, inside this same function: it needs room for the model call (at most ~35 s) and the send.
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };
const KEEP_DAYS = 7;

/** Writes one line in wa_webhook_log (what Fonnte sent and what we did). Never throws: logging must not lose a message. */
async function logCall(device: { id: string; workspace_id: string }, outcome: string, reason: string | null, contentType: string | null, payload: unknown) {
  try {
    const db = createAdminClient();
    await db.from('wa_webhook_log').insert({ workspace_id: device.workspace_id, device_id: device.id, outcome, reason, content_type: contentType, payload: payload ?? null });
    await db.from('wa_webhook_log').delete().eq('workspace_id', device.workspace_id).lt('received_at', new Date(Date.now() - KEEP_DAYS * 86400000).toISOString());
  } catch (e) {
    console.error('wa webhook log failed', e);
  }
}

/**
 * POST /api/wa/webhook/<secret>: Fonnte "incoming message" webhook for one WhatsApp device.
 * The secret in the URL identifies the device (see public.wa_devices.webhook_secret); an unknown secret gets 404.
 * Answers 200 quickly for anything it understood or chose to ignore, so Fonnte never retries or queues.
 * Answers 500 only when saving failed, so Fonnte retries a message that would otherwise be lost.
 * Every call is logged (wa_webhook_log, 7 days) with the raw payload, so a missing chat can be diagnosed.
 */
export async function POST(request: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  try {
    const device = await deviceBySecret(secret);
    if (!device) return new NextResponse(null, { status: 404, headers: NO_STORE });

    const contentType = request.headers.get('content-type');
    const payload = await readWebhookPayload(request);
    const parsed = parseFonnteWebhook(payload);
    if (!parsed) {
      await logCall(device, 'ignored', Object.keys(payload).length ? 'no text or media, or no device/sender' : 'empty body', contentType, payload);
      return NextResponse.json({ ok: true, ignored: true }, { headers: NO_STORE });
    }

    try {
      const res = await ingestMessage(device, parsed, payload);
      await logCall(device, res.stored ? 'stored' : 'ignored', res.reason ?? null, contentType, payload);
      // A sales number: the bot may answer a new lead. It runs after the reply to Fonnte, and a retried webhook (not new) never triggers it.
      if (res.stored && res.isNew && res.groupId && device.role === 'sales') {
        const groupId = res.groupId;
        // Where did this lead come from? The first message of the chat is compared with the ads' messages. Independent of the bot, and never in its way.
        // One sequence, in this order: 1) find the source, 2) a matching scenario flow, 3) the normal bot unless a flow already answered.
        after(async () => {
          if (!parsed.isGroup && !parsed.isFromMe) await captureLeadSource(device.workspace_id, groupId).catch((e) => console.error('lead source failed', e));
          const flow = await runFlowsFor(device, parsed, groupId).catch((e) => { console.error('flows failed', e); return { handled: false }; });
          if (!flow.handled) await runSalesBot(device, parsed, groupId).catch((e) => console.error('sales bot failed', e));
        });
      }
      return NextResponse.json({ ok: true, ...res }, { headers: NO_STORE });
    } catch (err: any) {
      await logCall(device, 'error', String(err?.message || err).slice(0, 300), contentType, payload);
      throw err;
    }
  } catch (err) {
    console.error('wa webhook failed', err);
    return NextResponse.json({ ok: false, error: 'save failed' }, { status: 500, headers: NO_STORE });
  }
}

/** Fonnte (and you, in a browser) can check the URL is alive. It reveals nothing about the device. */
export async function GET(_request: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  const device = await deviceBySecret(secret).catch(() => null);
  return device ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : new NextResponse(null, { status: 404, headers: NO_STORE });
}
