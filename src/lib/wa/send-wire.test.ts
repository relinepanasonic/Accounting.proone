import { describe, it, expect } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { FONNTE_SEND_URL, sendWhatsApp } from './send';

/**
 * The file really goes over HTTP as a multipart upload. A tiny local server plays Fonnte, and we look at the raw request it receives:
 * the multipart header, the "file" part with the real file name and type, the PDF bytes, the caption and the token.
 */
function fakeFonnte(): Promise<{ url: string; got: Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }>; close: () => void }> {
  return new Promise((resolve) => {
    let done!: (v: { headers: http.IncomingHttpHeaders; body: Buffer }) => void;
    const got = new Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }>((r) => { done = r; });
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        done({ headers: req.headers, body: Buffer.concat(chunks) });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ status: true, detail: 'success! message in queue' }));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/send`, got, close: () => server.close() }));
  });
}

describe('file upload on the wire', () => {
  it('sends a real multipart/form-data request with the PDF as the "file" part', async () => {
    const srv = await fakeFonnte();
    const pdf = new Uint8Array([...Buffer.from('%PDF-1.4\n'), 0, 1, 2, 250, 251, 252, ...Buffer.from('\n%%EOF')]);
    const viaLocal = ((url: any, init: any) => fetch(String(url) === FONNTE_SEND_URL ? srv.url : url, init)) as typeof fetch;

    const r = await sendWhatsApp(['120363012345678901@g.us'], '*Weekly Report* 2 - 8 Nov 2026\nProOne - Toko A', {
      token: 'SECRET-TOKEN',
      fetchImpl: viaLocal,
      file: { data: pdf, filename: 'Weekly Report 2-8 Nov 2026 - ProOne - Toko A.pdf', contentType: 'application/pdf' },
    });
    expect(r.ok).toBe(true);

    const { headers, body } = await srv.got;
    srv.close();
    expect(headers.authorization).toBe('SECRET-TOKEN');
    expect(headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);

    // multipart text fields carry their line breaks as CRLF on the wire
    const text = body.toString('latin1').replace(/\r\n/g, '\n');
    expect(text).toContain('name="target"');
    expect(text).toContain('120363012345678901@g.us');
    expect(text).toContain('name="countryCode"');
    expect(text).toContain('*Weekly Report* 2 - 8 Nov 2026\nProOne - Toko A');
    // the file part: its field name, real file name and type
    expect(text).toMatch(/name="file"; filename="Weekly Report 2-8 Nov 2026 - ProOne - Toko A\.pdf"/);
    expect(text).toMatch(/Content-Type: application\/pdf/);
    // and the exact bytes, untouched
    expect(body.includes(Buffer.from(pdf))).toBe(true);
    // no link is sent along with an uploaded file
    expect(text).not.toContain('name="url"');
  });

  it('a link-only file still goes as a plain form post with url and filename', async () => {
    const srv = await fakeFonnte();
    const viaLocal = ((url: any, init: any) => fetch(String(url) === FONNTE_SEND_URL ? srv.url : url, init)) as typeof fetch;
    await sendWhatsApp(['6281234567890'], 'cap', { token: 't', fetchImpl: viaLocal, file: { url: 'https://erp.test/api/wa/file/x/report.pdf', filename: 'Report.pdf' } });
    const { headers, body } = await srv.got;
    srv.close();
    expect(headers['content-type']).toMatch(/^application\/x-www-form-urlencoded/);
    const form = new URLSearchParams(body.toString());
    expect(form.get('url')).toBe('https://erp.test/api/wa/file/x/report.pdf');
    expect(form.get('filename')).toBe('Report.pdf');
  });
});
