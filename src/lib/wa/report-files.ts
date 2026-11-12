import { sendWhatsApp, type SendResult } from './send';

/**
 * Sends the weekly / monthly BOD report PDFs as real WhatsApp files (Fonnte Super package). Each PDF is one message, captioned with the
 * report title and the company. A PDF Fonnte refuses is not lost: its link goes out as text instead, so the BOD always gets the report.
 */

export interface ReportPdf { company: string; name: string; url: string }

/** "*Weekly (01 Nov 26 - 15 Nov 26) Report*" + the company. The headline's first line is the title. */
export function pdfCaption(headline: string, company: string): string {
  const title = (headline || '').split('\n')[0].trim();
  return [title, company].filter(Boolean).join('\n');
}

export async function sendReportPdfs(
  phones: string[],
  headline: string,
  files: ReportPdf[],
  opts: { token?: string; fetchImpl?: typeof fetch; pause?: (ms: number) => Promise<void> } = {},
): Promise<SendResult & { sent: string[]; fellBack: string[] }> {
  const f = opts.fetchImpl ?? fetch;
  const pause = opts.pause ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const sent: string[] = [];
  const failed: Array<{ file: ReportPdf; reason: string }> = [];

  for (const file of files) {
    // The first request to a report link makes and stores the PDF (it can take half a minute). We fetch it ourselves and upload the bytes
    // to Fonnte as a real file; only if that fails do we hand Fonnte the link (which it may refuse: it wants the format in the link).
    let data: Uint8Array | undefined;
    try {
      const res = await f(file.url, { signal: AbortSignal.timeout(90000) });
      if (res.ok && /pdf/i.test(res.headers.get('content-type') || 'pdf')) data = new Uint8Array(await res.arrayBuffer());
    } catch { /* fall back to the link */ }
    const r = await sendWhatsApp(phones, pdfCaption(headline, file.company), {
      token: opts.token, fetchImpl: opts.fetchImpl,
      file: data && data.byteLength > 0 ? { data, filename: file.name, contentType: 'application/pdf' } : { url: file.url, filename: file.name },
    });
    if (r.ok) sent.push(file.company); else failed.push({ file, reason: r.detail });
    await pause(2000);
  }

  const fellBack: string[] = [];
  let detail = sent.length ? `PDF sent: ${sent.join(', ')}.` : '';
  let ok = failed.length === 0;
  if (failed.length) {
    const text = [headline, ...failed.map((x) => `${x.file.company}: ${x.file.url}`)].filter(Boolean).join('\n');
    const t = await sendWhatsApp(phones, text, { token: opts.token, fetchImpl: opts.fetchImpl });
    ok = t.ok;
    fellBack.push(...failed.map((x) => x.file.company));
    detail += ` PDF refused for ${fellBack.join(', ')} (${failed[0].reason}); ${t.ok ? 'sent the link instead.' : `the link could not be sent either: ${t.detail}`}`;
  }
  return { ok, parts: sent.length + (failed.length ? 1 : 0), detail: detail.trim().slice(0, 400), sent, fellBack };
}
