import { describe, it, expect } from 'vitest';
import { pdfCaption, sendReportPdfs } from './report-files';

const HEADLINE = '*Weekly (01 Nov 26 - 15 Nov 26) Report*\nLaporan lengkap dengan grafik (PDF):';
const FILES = [
  { company: 'ProOne', name: 'ProOne.26.11.week3.pdf', url: 'https://erp.test/report-pdf?company=ProOne&sig=a' },
  { company: 'PLIG', name: 'PLIG.26.11.week3.pdf', url: 'https://erp.test/report-pdf?company=PLIG&sig=b' },
];
const noPause = async () => {};

/** A fake fetch: the report links answer 200, Fonnte answers per `fonnte(body)`. */
const fake = (fonnte: (body: URLSearchParams) => unknown) => {
  const calls: Array<{ url: string; body?: URLSearchParams }> = [];
  const impl = (async (url: any, init: any) => {
    if (String(url).startsWith('https://api.fonnte.com')) { calls.push({ url: String(url), body: init.body }); return new Response(JSON.stringify(fonnte(init.body))); }
    calls.push({ url: String(url) });
    return new Response('pdf');
  }) as any;
  return { impl, calls, fonnteCalls: () => calls.filter((c) => c.body) };
};

describe('pdfCaption', () => {
  it('is the report title and the company', () => {
    expect(pdfCaption(HEADLINE, 'PLIG')).toBe('*Weekly (01 Nov 26 - 15 Nov 26) Report*\nPLIG');
    expect(pdfCaption('', 'PLIG')).toBe('PLIG');
  });
});

describe('sendReportPdfs', () => {
  it('sends each PDF as its own file message with a caption', async () => {
    const f = fake(() => ({ status: true, detail: 'ok' }));
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r).toMatchObject({ ok: true, sent: ['ProOne', 'PLIG'], fellBack: [] });
    const calls = f.fonnteCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].body!.get('url')).toBe(FILES[0].url);
    expect(calls[0].body!.get('filename')).toBe('ProOne.26.11.week3.pdf');
    expect(calls[0].body!.get('message')).toBe('*Weekly (01 Nov 26 - 15 Nov 26) Report*\nProOne');
  });

  it('opens each report link first so the PDF is already made when Fonnte fetches it', async () => {
    const f = fake(() => ({ status: true }));
    await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    const order = f.calls.map((c) => (c.body ? 'fonnte' : 'warm'));
    expect(order).toEqual(['warm', 'fonnte', 'warm', 'fonnte']);
  });

  it('a refused PDF is replaced by its link as text; the PDF that worked is not sent again', async () => {
    const f = fake((body) => (body.get('url') ? (String(body.get('url')).includes('PLIG') ? { status: false, reason: 'file format not supported' } : { status: true }) : { status: true }));
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r).toMatchObject({ ok: true, sent: ['ProOne'], fellBack: ['PLIG'] });
    expect(r.detail).toContain('file format not supported');
    const texts = f.fonnteCalls().filter((c) => !c.body!.get('url'));
    expect(texts).toHaveLength(1);
    expect(texts[0].body!.get('message')).toContain(FILES[1].url);
    expect(texts[0].body!.get('message')).not.toContain(FILES[0].url);
  });

  it('is not ok when even the fallback link cannot be sent', async () => {
    const f = fake(() => ({ status: false, reason: 'insufficient quota' }));
    const r = await sendReportPdfs(['6281234567890'], HEADLINE, FILES, { token: 't', fetchImpl: f.impl, pause: noPause });
    expect(r.ok).toBe(false);
    expect(r.fellBack).toEqual(['ProOne', 'PLIG']);
    expect(r.detail).toContain('insufficient quota');
  });
});
