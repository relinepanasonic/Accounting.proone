/**
 * Sends WhatsApp text through the Fonnte API from the company number (the device whose token is FONNTE_TOKEN).
 * Server-side only: the token is a secret and never reaches the browser.
 */

export const FONNTE_SEND_URL = 'https://api.fonnte.com/send';
export const MAX_WA_CHARS = 3800;   // WhatsApp allows ~4096; keep a margin

/** Splits a long report at blank lines (then single lines, then hard) so each part fits one WhatsApp message. */
export function chunkMessage(text: string, max = MAX_WA_CHARS): string[] {
  const t = text.trim();
  if (t.length <= max) return t ? [t] : [];
  const parts: string[] = [];
  let cur = '';
  const push = () => { if (cur.trim()) parts.push(cur.trim()); cur = ''; };
  const add = (piece: string, sep: string) => {
    if (piece.length > max) {
      // a single block longer than the limit: cut it by lines, then hard
      push();
      let buf = '';
      for (const line of piece.split('\n')) {
        if (line.length > max) {
          if (buf) { parts.push(buf.trim()); buf = ''; }
          for (let i = 0; i < line.length; i += max) parts.push(line.slice(i, i + max));
        } else if ((buf ? buf.length + 1 : 0) + line.length > max) { parts.push(buf.trim()); buf = line; }
        else buf = buf ? `${buf}\n${line}` : line;
      }
      if (buf.trim()) parts.push(buf.trim());
      return;
    }
    if (cur && cur.length + sep.length + piece.length > max) push();
    cur = cur ? `${cur}${sep}${piece}` : piece;
  };
  for (const block of t.split(/\n{2,}/)) add(block, '\n\n');
  push();
  return parts;
}

export interface SendResult { ok: boolean; parts: number; detail: string }

/**
 * A file to attach (max 4 MB; needs the Fonnte Super package or higher). The text becomes its caption.
 *  - `data`: the file's bytes, uploaded to Fonnte directly (multipart "file") with its real name and type. This is the reliable way: Fonnte
 *    does not have to fetch anything, and it sees "Report.pdf" and application/pdf.
 *  - `url`: a public https link to the actual file (Fonnte "url"). Fonnte seems to work out the format from the link, so it should end in the
 *    file's extension (".pdf"); a link like "...?exp=1&sig=2" is refused as "file format not supported".
 */
export interface WaFile { url?: string; data?: Uint8Array; filename?: string; contentType?: string }

export const MAX_FILE_BYTES = 4 * 1024 * 1024;

const IMAGE_OR_VIDEO = /\.(jpe?g|png|gif|webp|heic|mp4|mov|3gp|webm)(\?|$)/i;

/** Sends `text` to every number (digits, 62...). Fonnte takes a comma-separated target list. With `file`, one message: the file with `text` as its caption. */
export async function sendWhatsApp(
  phones: string[],
  text: string,
  opts: { token?: string; fetchImpl?: typeof fetch; file?: WaFile } = {},
): Promise<SendResult> {
  const token = opts.token ?? process.env.FONNTE_TOKEN;
  if (!token) return { ok: false, parts: 0, detail: 'FONNTE_TOKEN is not set on the server.' };
  // A person is digits (62...); a WhatsApp group is its id plus @g.us.
  const targets = Array.from(new Set(phones.filter((p) => /^\d{8,15}$/.test(p) || /^\d{10,25}@g\.us$/.test(p))));
  if (targets.length === 0) return { ok: false, parts: 0, detail: 'No valid recipient number.' };
  const file = opts.file;
  if (file && !file.data && !(file.url && /^https:\/\//i.test(file.url))) return { ok: false, parts: 0, detail: 'The file link must be a public https link.' };
  if (file?.data && file.data.byteLength > MAX_FILE_BYTES) return { ok: false, parts: 0, detail: 'The file is over 4 MB (Fonnte limit).' };
  if (file?.data && file.data.byteLength === 0) return { ok: false, parts: 0, detail: 'The file is empty.' };
  // A file travels as ONE message (the text is its caption, up to 60,000 characters); plain text is split to fit WhatsApp.
  const parts = file ? (text.trim() || file.filename ? [text.trim()] : []) : chunkMessage(text);
  if (parts.length === 0) return { ok: false, parts: 0, detail: 'Nothing to send.' };

  const f = opts.fetchImpl ?? fetch;
  const details: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const fields: Record<string, string> = { target: targets.join(','), message: parts.length > 1 ? `(${i + 1}/${parts.length})\n${parts[i]}` : parts[i], countryCode: '62' };
    let body: URLSearchParams | FormData;
    if (file?.data) {
      // Uploaded as a real file: multipart, with its name and type (the Content-Type header with the boundary is set by fetch).
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      const name = file.filename || 'file';
      form.append('file', new Blob([file.data as BlobPart], { type: file.contentType || 'application/pdf' }), name);
      body = form;
    } else {
      body = new URLSearchParams(fields);
      if (file?.url) {
        body.set('url', file.url);
        // Images and videos have no file name; documents show theirs.
        if (file.filename && !IMAGE_OR_VIDEO.test(file.url) && !IMAGE_OR_VIDEO.test(file.filename)) body.set('filename', file.filename);
      }
    }
    let res: Response;
    try {
      res = await f(FONNTE_SEND_URL, { method: 'POST', headers: { Authorization: token }, body, signal: AbortSignal.timeout(45000) });
    } catch (e: any) {
      return { ok: false, parts: i, detail: `Could not reach Fonnte: ${e?.message || e}` };
    }
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    // Fonnte answers { status: true, ... } or { status: false, reason: '...' }.
    // (Fonnte's own docs once wrote "Status" with a capital S, so both spellings count.)
    const accepted = !!json && (json.status === true || json.Status === true);
    if (!res.ok || !accepted) {
      return { ok: false, parts: i, detail: `Fonnte refused part ${i + 1}: ${json?.reason || json?.detail || `HTTP ${res.status}`}` };
    }
    details.push(String(json.detail || 'ok'));
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  return { ok: true, parts: parts.length, detail: details.join(' | ').slice(0, 300) };
}
