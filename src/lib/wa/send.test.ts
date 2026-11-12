import { describe, it, expect } from 'vitest';
import { chunkMessage, sendWhatsApp } from './send';

const reply = (json: unknown, status = 200) => async () => new Response(JSON.stringify(json), { status });

describe('chunkMessage', () => {
  it('keeps a short text whole and drops an empty one', () => {
    expect(chunkMessage('hello')).toEqual(['hello']);
    expect(chunkMessage('   ')).toEqual([]);
  });
  it('splits at blank lines and never exceeds the limit', () => {
    const block = 'x'.repeat(40);
    const text = Array.from({ length: 10 }, () => block).join('\n\n');
    const parts = chunkMessage(text, 100);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(100);
    expect(parts.join('\n\n').replace(/\n+/g, '')).toBe(text.replace(/\n+/g, ''));
  });
  it('cuts a block longer than the limit by lines, then hard', () => {
    const long = Array.from({ length: 30 }, (_, i) => `line ${i} ${'y'.repeat(20)}`).join('\n');
    for (const p of chunkMessage(long, 120)) expect(p.length).toBeLessThanOrEqual(120);
    const word = 'z'.repeat(250);
    expect(chunkMessage(word, 100).map((p) => p.length)).toEqual([100, 100, 50]);
  });
});

describe('sendWhatsApp', () => {
  it('refuses without a token, without valid numbers, or with nothing to send', async () => {
    const saved = process.env.FONNTE_TOKEN; delete process.env.FONNTE_TOKEN;
    expect((await sendWhatsApp(['6281234567890'], 'hi')).detail).toMatch(/FONNTE_TOKEN/);
    process.env.FONNTE_TOKEN = saved ?? '';
    expect((await sendWhatsApp(['abc', '123'], 'hi', { token: 't' })).detail).toMatch(/No valid recipient/);
    expect((await sendWhatsApp(['6281234567890'], '  ', { token: 't' })).detail).toMatch(/Nothing/);
  });

  it('posts the token, a de-duplicated comma list and country code', async () => {
    let seen: any;
    const r = await sendWhatsApp(['6281234567890', '6281234567890', '6289999999999'], 'hello', {
      token: 'TOK', fetchImpl: (async (url: any, init: any) => { seen = { url, init }; return new Response(JSON.stringify({ status: true, detail: 'success! message in queue' })); }) as any,
    });
    expect(r).toMatchObject({ ok: true, parts: 1 });
    expect(seen.url).toBe('https://api.fonnte.com/send');
    expect(seen.init.headers.Authorization).toBe('TOK');
    expect(seen.init.body.get('target')).toBe('6281234567890,6289999999999');
    expect(seen.init.body.get('message')).toBe('hello');
    expect(seen.init.body.get('countryCode')).toBe('62');
  });

  it('accepts a WhatsApp group id (id@g.us) as a target', async () => {
    let seen: any;
    const r = await sendWhatsApp(['120363012345678901@g.us'], 'hi', { token: 't', fetchImpl: (async (_u: any, init: any) => { seen = init; return new Response(JSON.stringify({ status: true })); }) as any });
    expect(r.ok).toBe(true);
    expect(seen.body.get('target')).toBe('120363012345678901@g.us');
  });

  it('sends a file as one message: url, filename for a document, the text as caption', async () => {
    let seen: any; let calls = 0;
    const longCaption = 'x'.repeat(5000);
    const r = await sendWhatsApp(['120363012345678901@g.us'], longCaption, {
      token: 't', file: { url: 'https://erp.example.com/api/wa/file/1?sig=a', filename: 'Weekly Report 2-8 Nov 2026 - Toko A.pdf' },
      fetchImpl: (async (_u: any, init: any) => { calls++; seen = init; return new Response(JSON.stringify({ status: true, detail: 'success! message in queue' })); }) as any,
    });
    expect(r).toMatchObject({ ok: true, parts: 1 });
    expect(calls).toBe(1);
    expect(seen.body.get('url')).toBe('https://erp.example.com/api/wa/file/1?sig=a');
    expect(seen.body.get('filename')).toBe('Weekly Report 2-8 Nov 2026 - Toko A.pdf');
    expect(seen.body.get('message')).toBe(longCaption);
  });

  it('an image gets no file name, and the link must be https', async () => {
    let seen: any;
    await sendWhatsApp(['6281234567890'], 'cap', { token: 't', file: { url: 'https://x.test/a.jpg', filename: 'a.jpg' }, fetchImpl: (async (_u: any, init: any) => { seen = init; return new Response(JSON.stringify({ status: true })); }) as any });
    expect(seen.body.get('filename')).toBeNull();
    const bad = await sendWhatsApp(['6281234567890'], 'cap', { token: 't', file: { url: 'http://x.test/a.pdf' } });
    expect(bad.detail).toMatch(/https/);
  });

  it('reports Fonnte refusing', async () => {
    const r = await sendWhatsApp(['6281234567890'], 'hi', { token: 't', fetchImpl: reply({ status: false, reason: 'token invalid' }) as any });
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('token invalid');
  });

  it('reports a network failure', async () => {
    const r = await sendWhatsApp(['6281234567890'], 'hi', { token: 't', fetchImpl: (async () => { throw new Error('boom'); }) as any });
    expect(r).toMatchObject({ ok: false });
    expect(r.detail).toContain('boom');
  });
});
