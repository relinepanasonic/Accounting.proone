/**
 * Messages that are not a lead: a verification code (OTP) from Facebook, Google, a bank..., or the automatic greeting of a company's customer service.
 * A lead is a person who asks about our expertise in marketplaces and around it. A chat that matches is marked "ignored": the bot stays quiet, no lead
 * is made, and it stays out of the numbers. Only STRONG patterns count, so a real lead is never lost; anything else is marked by hand ("Not a lead").
 * Pure, so the rules are tested.
 */
const norm = (t: string) => String(t ?? '').replace(/\s+/g, ' ').trim();

const CODE_PATTERNS: RegExp[] = [
  /\b(otp|one[- ]?time (password|passcode|code|pin))\b/i,
  /\b(kode|code)\b.{0,30}\b(verifikasi|verification|konfirmasi|confirmation|keamanan|security|login|masuk|otp)\b/i,
  /\b(verifikasi|verification|konfirmasi|confirmation|security|login)\b.{0,20}\b(kode|code|pin)\b/i,
  /\b\d{4,8}\b.{0,15}\b(is your|adalah kode|merupakan kode|is the code)\b/i,
  /\b(jangan|do not|don't|never)\b.{0,25}\b(bagikan|berikan|beritahu|share|give|tell)\b.{0,30}\b(kode|code|siapa|anyone|pin)\b/i,
  /\b(your|kode)\b.{0,25}\b(code|kode)\b.{0,15}\b(is|adalah)\b.{0,6}\b\d{4,8}\b/i,
];

/** The greeting a company's customer-service account sends by itself when anyone writes to it. */
const AUTO_GREETING = /(terima kasih (sudah|telah) menghubungi|selamat datang di|thank you for (contacting|reaching)|sebelumnya dengan (kakak|bapak|ibu) siapa)/i;
const SERVICE_NAME = /\b(customer service|layanan pelanggan|cs\b|official|helpdesk|help desk|support)\b/i;

/** Why this message is not a lead, or null when it may be one. `name` = the chat's name (the company's account name). */
export function notALeadReason(body: string | null | undefined, name?: string | null): string | null {
  const t = norm(body || '');
  if (!t) return null;
  if (CODE_PATTERNS.some((r) => r.test(t))) return 'A verification code (OTP), not a lead.';
  if (AUTO_GREETING.test(t) && SERVICE_NAME.test(String(name || ''))) return `The automatic greeting of ${norm(name || 'a company')}, not a lead.`;
  return null;
}
