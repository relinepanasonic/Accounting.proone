import { NextResponse } from 'next/server';
import { parseFonnteWebhook, readWebhookPayload } from '@/lib/wa/parse-webhook';
import { deviceBySecret, ingestMessage } from '@/lib/wa/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/wa/webhook/<secret>: Fonnte "incoming message" webhook for one WhatsApp device.
 * The secret in the URL identifies the device (see public.wa_devices.webhook_secret); an unknown secret gets 404.
 * Answers 200 quickly for anything it understood or chose to ignore, so Fonnte never retries or queues.
 * Answers 500 only when saving failed, so Fonnte retries a message that would otherwise be lost.
 */
export async function POST(request: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  try {
    const device = await deviceBySecret(secret);
    if (!device) return new NextResponse(null, { status: 404, headers: NO_STORE });

    const payload = await readWebhookPayload(request);
    const parsed = parseFonnteWebhook(payload);
    if (!parsed) return NextResponse.json({ ok: true, ignored: true }, { headers: NO_STORE });

    const res = await ingestMessage(device, parsed, payload);
    return NextResponse.json({ ok: true, ...res }, { headers: NO_STORE });
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
