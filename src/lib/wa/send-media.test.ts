import { describe, it, expect } from 'vitest';
import { asDelivery, sendMedia, type MediaStorage } from './send-media';

const BYTES = new Uint8Array([255, 216, 255, 1, 2, 3]);
const ok = () => new Response(JSON.stringify({ status: true, detail: 'success! message in queue' }));

/** A fake storage, and a fake Fonnte that answers per call. */
function rig(answers: Array<(body: URLSearchParams | FormData) => Response>, storage?: Partial<MediaStorage>) {
  const calls: Array<URLSearchParams | FormData> = [];
  const fetchImpl = (async (_u: any, init: any) => { calls.push(init.body); return answers[Math.min(calls.length - 1, answers.length - 1)](init.body); }) as any;
  const stored: string[] = [];
  const st: MediaStorage = {
    upload: async (p) => { stored.push(p); return true; },
    signedUrl: async (p) => `https://files.test/sign/${p}?token=abc`,
    ...storage,
  };
  return { calls, fetchImpl, stored, st };
}
const base = { phones: ['120363012345678901@g.us'], caption: 'cap', data: BYTES, filename: 'Report.jpg', contentType: 'image/jpeg', path: 'session/ws/2026-11/x.jpg' };

describe('sendMedia', () => {
  it('"link" (the default): stores the file and gives Fonnte a link, so WhatsApp can show a preview', async () => {
    const r = rig([ok]);
    const out = await sendMedia({ ...base, delivery: 'link', storage: r.st, token: 't', fetchImpl: r.fetchImpl });
    expect(out).toMatchObject({ ok: true, mode: 'link', stored: true });
    expect(r.stored).toEqual(['session/ws/2026-11/x.jpg']);
    expect(r.calls).toHaveLength(1);
    const form = r.calls[0] as URLSearchParams;
    expect(form.get('url')).toBe('https://files.test/sign/session/ws/2026-11/x.jpg?token=abc');
    expect(form.get('message')).toBe('cap');
  });

  it('"upload": sends the file itself, and still keeps a copy', async () => {
    const r = rig([ok]);
    const out = await sendMedia({ ...base, delivery: 'upload', storage: r.st, token: 't', fetchImpl: r.fetchImpl });
    expect(out).toMatchObject({ ok: true, mode: 'upload', stored: true });
    expect(r.calls[0]).toBeInstanceOf(FormData);
    expect((r.calls[0] as FormData).get('url')).toBeNull();
    expect(r.stored).toHaveLength(1);
  });

  it('if Fonnte cannot use the link, the same message goes out as an upload', async () => {
    const r = rig([() => new Response(JSON.stringify({ status: false, reason: 'url unreachable' })), ok]);
    const out = await sendMedia({ ...base, delivery: 'link', storage: r.st, token: 't', fetchImpl: r.fetchImpl });
    expect(out).toMatchObject({ ok: true, mode: 'upload' });
    expect(r.calls).toHaveLength(2);
    expect(r.calls[0]).toBeInstanceOf(URLSearchParams);
    expect(r.calls[1]).toBeInstanceOf(FormData);
  });

  it('a refusal that is not about the link (token, quota) is not retried as an upload', async () => {
    const r = rig([() => new Response(JSON.stringify({ status: false, reason: 'token invalid' }))]);
    const out = await sendMedia({ ...base, delivery: 'link', storage: r.st, token: 't', fetchImpl: r.fetchImpl });
    expect(out).toMatchObject({ ok: false, mode: 'link' });
    expect(out.detail).toContain('token invalid');
    expect(r.calls).toHaveLength(1);
  });

  it('when the file cannot be stored or linked, it is still sent (as an upload)', async () => {
    const r = rig([ok], { upload: async () => false });
    const out = await sendMedia({ ...base, delivery: 'link', storage: r.st, token: 't', fetchImpl: r.fetchImpl });
    expect(out).toMatchObject({ ok: true, mode: 'upload', stored: false });
    const r2 = rig([ok], { signedUrl: async () => null });
    expect(await sendMedia({ ...base, delivery: 'link', storage: r2.st, token: 't', fetchImpl: r2.fetchImpl })).toMatchObject({ ok: true, mode: 'upload' });
    const r3 = rig([ok], { upload: async () => { throw new Error('storage down'); } });
    expect(await sendMedia({ ...base, delivery: 'link', storage: r3.st, token: 't', fetchImpl: r3.fetchImpl })).toMatchObject({ ok: true, mode: 'upload', stored: false });
  });

  it('asDelivery only accepts "upload"; everything else is the default "link"', () => {
    expect(asDelivery('upload')).toBe('upload');
    expect(asDelivery('link')).toBe('link');
    expect(asDelivery(undefined)).toBe('link');
    expect(asDelivery('nonsense')).toBe('link');
  });
});
