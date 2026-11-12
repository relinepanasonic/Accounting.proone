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

/** Sends `text` to every number (digits, 62...). Fonnte takes a comma-separated target list. */
export async function sendWhatsApp(
  phones: string[],
  text: string,
  opts: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<SendResult> {
  const token = opts.token ?? process.env.FONNTE_TOKEN;
  if (!token) return { ok: false, parts: 0, detail: 'FONNTE_TOKEN is not set on the server.' };
  const targets = Array.from(new Set(phones.filter((p) => /^\d{8,15}$/.test(p))));
  if (targets.length === 0) return { ok: false, parts: 0, detail: 'No valid recipient number.' };
  const parts = chunkMessage(text);
  if (parts.length === 0) return { ok: false, parts: 0, detail: 'Nothing to send.' };

  const f = opts.fetchImpl ?? fetch;
  const details: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const body = new URLSearchParams({ target: targets.join(','), message: parts.length > 1 ? `(${i + 1}/${parts.length})\n${parts[i]}` : parts[i], countryCode: '62' });
    let res: Response;
    try {
      res = await f(FONNTE_SEND_URL, { method: 'POST', headers: { Authorization: token }, body, signal: AbortSignal.timeout(45000) });
    } catch (e: any) {
      return { ok: false, parts: i, detail: `Could not reach Fonnte: ${e?.message || e}` };
    }
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    // Fonnte answers { status: true, ... } or { status: false, reason: '...' }.
    if (!res.ok || !json || json.status !== true) {
      return { ok: false, parts: i, detail: `Fonnte refused part ${i + 1}: ${json?.reason || json?.detail || `HTTP ${res.status}`}` };
    }
    details.push(String(json.detail || 'ok'));
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  return { ok: true, parts: parts.length, detail: details.join(' | ').slice(0, 300) };
}
