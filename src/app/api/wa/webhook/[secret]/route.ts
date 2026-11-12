import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { parseFonnteWebhook, readWebhookPayload } from '@/lib/wa/parse-webhook';
import { deviceBySecret, ingestMessage } from '@/lib/wa/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
