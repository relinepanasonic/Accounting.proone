import crypto from 'crypto';

/**
 * Short-lived links to one document, so Make.com's "Get a file" (which cannot send a header) can download it.
 * The signature covers what the link opens and its expiry; it is made with ERP_API_KEY, which never leaves the server.
 */
const FETCH_TTL_SECONDS = 30 * 60;
/** The link that goes into the WhatsApp message: it must still open weeks later. */
export const SHARE_TTL_SECONDS = 400 * 24 * 3600;

const hmac = (text: string) => crypto.createHmac('sha256', process.env.ERP_API_KEY || '').update(text).digest('hex');

const same = (expected: string, given: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(String(given));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const live = (exp: string | null) => {
  const e = Number(exp);
  return Number.isFinite(e) && e >= Math.floor(Date.now() / 1000) ? e : null;
};

// ---- the report PDFs: company + date

const sign = (company: string, date: string, exp: number) => hmac(`${company.toLowerCase()}|${date}|${exp}`);

export function signedReportUrl(origin: string, company: string, date: string, ttlSeconds = FETCH_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${origin}/api/v1/erp/report-pdf?company=${encodeURIComponent(company)}&date=${date}&exp=${exp}&sig=${sign(company, date, exp)}`;
}

export function validReportSignature(company: string, date: string, exp: string | null, sig: string | null): boolean {
  if (!process.env.ERP_API_KEY || !exp || !sig) return false;
  const e = live(exp);
  return e !== null && same(sign(company, date, e), sig);
}

// ---- the Drive documents: one document key (invoice:<id>, faktur:<id>, bukti:<id>)

const signKey = (key: string, exp: number) => hmac(`doc|${key}|${exp}`);

export function signedDocUrl(origin: string, key: string): string {
  const exp = Math.floor(Date.now() / 1000) + FETCH_TTL_SECONDS;
  return `${origin}/api/v1/erp/drive-file?key=${encodeURIComponent(key)}&exp=${exp}&sig=${signKey(key, exp)}`;
}

export function validDocSignature(key: string, exp: string | null, sig: string | null): boolean {
  if (!process.env.ERP_API_KEY || !exp || !sig) return false;
  const e = live(exp);
  return e !== null && same(signKey(key, e), sig);
}
