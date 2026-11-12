import { describe, it, expect } from 'vitest';
import { pdfCaption, sendReportPdfs } from './report-files';

const HEADLINE = '*Weekly (01 Nov 26 - 15 Nov 26) Report*\nLaporan lengkap dengan grafik (PDF):';
const FILES = [
  { company: 'ProOne', name: 'ProOne.26.11.week3.pdf', url: 'https://erp.test/report-pdf?company=ProOne&sig=a' },
  { company: 'PLIG', name: 'PLIG.26.11.week3.pdf', url: 'https://erp.test/report-pdf?company=PLIG&sig=b' },
];
const noPause = async () => {};

/**
 * A fake fetch. The report links answer with a PDF (or with `linkStatus`); Fonnte answers per `fonnte(body)`.
 * A Fonnte call is one that goes to api.fonnte.com.
 */
const fake = (fonnte: (body: URLSearchParams | FormData) => unknown, linkStatus = 200) => {
  const calls: Array<{ url: string; body?: URLSearchParams | FormData }> = [];
  const impl = (async (url: any, init: any) => {
    if (String(url).startsWith('https://api.fonnte.com')) { calls.push({ url: String(url), body: init.body }); return new Response(JSON.stringify(fonnte(init.body))); }
    calls.push({ url: String(url) });
    return linkStatus === 200 ? new Response(new Uint8Array([37, 80, 68, 70]), { headers: { 'content-type': 'application/pdf' } }) : new Response('nope', { status: linkStatus });
  }) as any;
  return { impl, calls, fonnteCalls: () => calls.filter((c) => c.body) };
};

const fileName = (b: any) => (b.get('file') as File | null)?.name || null;

describe('pdfCaption', () => {
  it('is the report title and the company', () => {
    expect(pdfCaption(HEADLINE, 'PLIG')).toBe('*Weekly (01 Nov 26 - 15 Nov 26) Report*\nPLIG');
    expect(pdfCaption('', 'PLIG')).toBe('PLIG');
  });
});

describe('sendReportPdfs', () => {
  it('fetches each PDF and uploads it to Fonnte as a real file with its name, type and a caption', async () => {
    const f = fake(() => ({ status: true, detail: 'ok' }));
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r).toMatchObject({ ok: true, sent: ['ProOne', 'PLIG'], fellBack: [] });
    const calls = f.fonnteCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].body).toBeInstanceOf(FormData);
    expect(fileName(calls[0].body)).toBe('ProOne.26.11.week3.pdf');
    expect(((calls[0].body as FormData).get('file') as File).type).toBe('application/pdf');
    expect((calls[0].body as FormData).get('url')).toBeNull();
    expect((calls[0].body as FormData).get('message')).toBe('*Weekly (01 Nov 26 - 15 Nov 26) Report*\nProOne');
  });

  it('opens each report link first (so the PDF is made), then sends it', async () => {
    const f = fake(() => ({ status: true }));
    await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(f.calls.map((c) => (c.body ? 'fonnte' : 'fetch-link'))).toEqual(['fetch-link', 'fonnte', 'fetch-link', 'fonnte']);
  });

  it('if our own link cannot be fetched, Fonnte is handed the link instead', async () => {
    const f = fake(() => ({ status: true }), 500);
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r.ok).toBe(true);
    const first = f.fonnteCalls()[0].body as URLSearchParams;
    expect(first.get('url')).toBe(FILES[0].url);
  });

  it('a refused PDF is replaced by its link as text; the PDF that worked is not sent again', async () => {
    const f = fake((body) => (fileName(body) && String(fileName(body)).includes('PLIG') ? { status: false, reason: 'file format not supported' } : { status: true }));
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r).toMatchObject({ ok: true, sent: ['ProOne'], fellBack: ['PLIG'] });
    expect(r.detail).toContain('file format not supported');
    const texts = f.fonnteCalls().filter((c) => !fileName(c.body) && c.body instanceof URLSearchParams);
    expect(texts).toHaveLength(1);
    expect((texts[0].body as URLSearchParams).get('message')).toContain(FILES[1].url);
    expect((texts[0].body as URLSearchParams).get('message')).not.toContain(FILES[0].url);
  });

  it('is not ok when even the fallback link cannot be sent', async () => {
    const f = fake(() => ({ status: false, reason: 'insufficient quota' }));
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r.ok).toBe(false);
    expect(r.fellBack).toEqual(['ProOne', 'PLIG']);
    expect(r.detail).toContain('insufficient quota');
  });
});
