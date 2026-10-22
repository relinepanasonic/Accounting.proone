import crypto from 'crypto';

/**
 * A short-lived link to one report PDF, so Make.com's "Get a file" (which cannot send a header) can download it.
 * The signature covers the company, the date and the expiry; it is made with ERP_API_KEY, which never leaves the server.
 */
const TTL_SECONDS = 30 * 60;

const sign = (company: string, date: string, exp: number) => {
  const key = process.env.ERP_API_KEY || '';
  return crypto.createHmac('sha256', key).update(`${company.toLowerCase()}|${date}|${exp}`).digest('hex');
};

export function signedReportUrl(origin: string, company: string, date: string): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${origin}/api/v1/erp/report-pdf?company=${encodeURIComponent(company)}&date=${date}&exp=${exp}&sig=${sign(company, date, exp)}`;
}

export function validReportSignature(company: string, date: string, exp: string | null, sig: string | null): boolean {
  if (!process.env.ERP_API_KEY || !exp || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(company, date, e));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
