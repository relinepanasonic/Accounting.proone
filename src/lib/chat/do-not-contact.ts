/**
 * A lead who clearly says NO or asks not to be contacted ("jangan ganggu saya", "tidak minat", "stop menghubungi", "saya laporkan") goes to LOST: nothing is
 * ever sent to them again (no follow-up, no broadcast), the bot goes quiet, and they get one polite goodbye. This avoids reports and a block of the number.
 * "Not now" ("belum minat", "nanti dulu", "tidak jadi") is NOT this: that lead is Cold Leads and may still get the educational messages.
 * Only STRONG phrases count, so a real lead is never lost by a word in passing. Pure, so the rules are tested.
 */
const norm = (t: string) => String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

const PATTERNS: RegExp[] = [
  /\bjangan (di)?(ganggu|hubungi|chat|chatting|telepon|telpon|telp|wa|spam|whatsapp)\b/,
  /\bjangan kirim (lagi|pesan|promo|info|chat|wa|iklan)\b/,
  /\b(tidak|ga|gak|nggak|ngga|enggak) (usah|perlu|mau|ingin) (dihubungi|diganggu|dichat|ditelepon|dikirim|dikontak|menghubungi|mengganggu|hubungi|chat lagi)\b/,
  /\b(berhenti|stop|setop) (me)?(ngirim|kirim|nghubungi|hubungi|menghubungi|ganggu|mengganggu|chat|ngechat|spam|telepon|nelpon)\b/,
  /^(tolong |mohon )?(stop|berhenti)( ya| dong| aja| kak| deh)*$/,
  /\b(tidak|ga|gak|nggak|ngga|enggak|kurang) (berminat|minat|tertarik|butuh)\b/,
  /\b(hapus|delete) (nomor|no|kontak|data) (saya|ku|aku)\b/,
  /\b(ini |itu |dasar )?spam\b/,
  /\b(saya|aku|gue|gw) (akan |mau |bakal )?(laporkan|lapor|report|blokir|block|blok)\b/,
  /\b(unsubscribe|opt ?out|remove me|do not contact|don t contact|stop messaging|leave me alone)\b/,
  /\bganggu (banget|sekali|aja|saja|deh)\b/,
];

/** Does the lead clearly ask not to be contacted again, or clearly say no? */
export function doNotContact(text: string | null | undefined): boolean {
  const t = norm(text || '');
  if (!t || t.length > 300) return false;                       // a long message is a conversation, not a "no"
  if (/\b(jangan lupa|jgn lupa|belum|nanti dulu|nanti saja)\b/.test(t) && !/\b(jangan|stop|berhenti) (di)?(ganggu|hubungi|chat|kirim|spam)\b/.test(t)) return false;
  return PATTERNS.some((r) => r.test(t));
}
