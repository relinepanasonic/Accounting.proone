import crypto from 'crypto';

/**
 * Links Fonnte can open without a login: Fonnte downloads the file from a public https link, then sends it on WhatsApp.
 * The signature covers what the link opens and when it expires; it is made with ERP_API_KEY, which never leaves the server.
 */

export const ERP_ORIGIN = 'https://erp.profesoronline.id';
export const FILE_TTL_SECONDS = 24 * 3600;

const hmac = (text: string) => crypto.createHmac('sha256', process.env.ERP_API_KEY || '').update(text).digest('hex');

const same = (expected: string, given: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(String(given));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** A link to the weekly report PDF of one draft (wa_outbox row). */
export function signedWeeklyPdfUrl(id: string, ttlSeconds = FILE_TTL_SECONDS, origin = ERP_ORIGIN, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${origin}/api/wa/file/${encodeURIComponent(id)}?exp=${exp}&sig=${hmac(`wa-weekly|${id}|${exp}`)}`;
}

export function validWeeklyPdfSignature(id: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!process.env.ERP_API_KEY || !exp || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Math.floor(now / 1000)) return false;
  return same(hmac(`wa-weekly|${id}|${e}`), sig);
}

/** A link to the weekly report IMAGE of one draft; it ends in ".jpg" so anything that opens it knows it is an image. */
export function signedWeeklyImageUrl(id: string, ttlSeconds = 3600, origin = ERP_ORIGIN, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${origin}/api/wa/image/${encodeURIComponent(id)}/Weekly-Report.jpg?exp=${exp}&sig=${hmac(`wa-weekly-img|${id}|${exp}`)}`;
}

export function validWeeklyImageSignature(id: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!process.env.ERP_API_KEY || !exp || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Math.floor(now / 1000)) return false;
  return same(hmac(`wa-weekly-img|${id}|${e}`), sig);
}
