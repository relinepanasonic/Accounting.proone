/**
 * Fefe as a personal assistant for the sales team and Herlan: offline meetings entered by WhatsApp, and the meeting notes (MoM) she asks for after every meeting.
 * Pure parts here, so the rules are tested. Times are Jakarta (WIB, UTC+7).
 */
const WIB = 7 * 3600000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6, jul: 7, juli: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12,
};

const jkt = (d: Date) => new Date(d.getTime() + WIB);

/** "19 Nov 26": the date as the team writes it. */
export const dmyShort = (d: Date) => { const j = jkt(d); return `${j.getUTCDate()} ${MONTH_NAMES[j.getUTCMonth()]} ${String(j.getUTCFullYear()).slice(2)}`; };
/** "14.00": the time of day. */
export const hmDot = (d: Date) => { const j = jkt(d); return `${String(j.getUTCHours()).padStart(2, '0')}.${String(j.getUTCMinutes()).padStart(2, '0')}`; };

/** A date written by a person: "19 Nov 26", "19 November 2026", "19/11/2026", "besok", "lusa", "hari ini". Null when it is not a date. */
export function parseDateText(raw: string, now: Date): { y: number; m: number; d: number } | null {
  const t = String(raw ?? '').toLowerCase().trim();
  if (!t) return null;
  const today = jkt(now);
  const plus = (n: number) => { const x = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
  if (/\b(hari ini|today)\b/.test(t)) return plus(0);
  if (/\b(besok|tomorrow)\b/.test(t)) return plus(1);
  if (/\blusa\b/.test(t)) return plus(2);
  const DOW: Record<string, number> = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
  const wd = /\b(minggu|senin|selasa|rabu|kamis|jumat|jum'at|sabtu)\b/.exec(t);
  if (wd && !/\d/.test(t)) {
    let add = (DOW[wd[1]] - today.getUTCDay() + 7) % 7;
    if (/\b(depan|next)\b/.test(t)) add += 7;
    return plus(add);
  }
  const year = (y: string | undefined) => { if (!y) return today.getUTCFullYear(); const n = Number(y); return y.length <= 2 ? 2000 + n : n; };
  let m = /(\d{1,2})[\s./-]*([a-z]{3,9})\.?[\s./,-]*(\d{2,4})?/.exec(t);
  if (m && MONTHS[m[2]]) return valid(year(m[3]), MONTHS[m[2]], Number(m[1]));
  m = /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.exec(t);
  if (m) return valid(year(m[3]), Number(m[2]), Number(m[1]));
  return null;
}
function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const x = new Date(Date.UTC(y, m - 1, d));
  return x.getUTCMonth() === m - 1 ? { y, m, d } : null;
}

/** A time written by a person: "14.00", "14:30", "jam 2 siang", "9 pagi", "14". Null when it is not a time. */
export function parseTimeText(raw: string): { h: number; m: number } | null {
  const t = String(raw ?? '').toLowerCase().trim();
  if (!t) return null;
  let h: number; let mi = 0;
  let m = /(\d{1,2})\s*[.:]\s*(\d{2})/.exec(t);
  if (m) { h = Number(m[1]); mi = Number(m[2]); }
  else if ((m = /(?:jam\s*)?(\d{1,2})\b/.exec(t))) h = Number(m[1]);
  else return null;
  if (/\b(sore|malam)\b/.test(t) && h < 12) h += 12;
  if (/\bsiang\b/.test(t) && h < 11) h += 12;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, m: mi };
}

/** The moment of a meeting from the date and the time the person wrote (Jakarta). */
export function whenOf(dateText: string, timeText: string, now: Date): Date | null {
  const d = parseDateText(dateText, now); const t = parseTimeText(timeText);
  return d && t ? new Date(Date.UTC(d.y, d.m - 1, d.d, t.h, t.m) - WIB) : null;
}

/** The AI's "YYYY-MM-DDTHH:mm" (Jakarta time) as a moment. Null when it is not one. */
export function isoJakarta(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(s ?? '').trim());
  if (!m) return null;
  const v = valid(Number(m[1]), Number(m[2]), Number(m[3]));
  return v ? new Date(Date.UTC(v.y, v.m - 1, v.d, Number(m[4]), Number(m[5])) - WIB) : null;
}

export interface MeetingAsk { withWhom: string; start: Date; minutes: number; place: string }

/** The reply to a request that is too early to book, or in the past. */
export const pastText = 'Waktunya sudah lewat kak. Tulis lagi tanggal dan jamnya ya.';

export const offlineTemplate = ['Hi Fefe', 'Meeting Offline', 'Dengan:', 'Tanggal:', 'Jam:', 'Lokasi:'].join('\n');

// ---------------------------------------------------------------- the meeting notes (MoM)
/** 1 to 2 hours after a meeting: the message that asks for the notes. */
export const momAskText = (name: string, m: { start: Date; with: string }) => [
  `Hi ${name}`,
  'Fefe butuh dibantu untuk Meeting',
  `   tanggal : ${dmyShort(m.start)} jam ${hmDot(m.start)}`,
  `   Dengan : ${m.with}`,
  '   Notes meetingnya apa ya?',
  '',
  'Biar Fefe bantu pencatatan',
].join('\n');

/** How long after the meeting ENDS Fefe asks, and until when she still does. */
export const MOM_AFTER_MIN = 60;
export const MOM_UNTIL_HOURS = 30;
/** Fefe does not message people at night: from this hour to the morning the question waits. */
export const MOM_QUIET_FROM = 21;
export const MOM_QUIET_TO = 7;
export const inQuietHours = (now: Date) => { const h = jkt(now).getUTCHours(); return h >= MOM_QUIET_FROM || h < MOM_QUIET_TO; };

/** Is a meeting ready to be asked about: an hour after its end, not older than MOM_UNTIL_HOURS, and not at night. */
export function momDue(visitAt: Date, endsAt: Date | null, now: Date): boolean {
  const end = endsAt ?? new Date(visitAt.getTime() + 60 * 60000);
  const sinceEnd = now.getTime() - end.getTime();
  return sinceEnd >= MOM_AFTER_MIN * 60000 && sinceEnd <= MOM_UNTIL_HOURS * 3600000 && !inQuietHours(now);
}

/** The answer to "Notes meetingnya apa ya?": the notes, or "skip", or "later". */
export function readMomReply(text: string | null | undefined): { kind: 'skip' | 'later' | 'notes'; notes: string } | null {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const f = t.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(skip|lewati|tidak ada|ga ada|gak ada|ngga ada|tidak ada notes|ga ada notes|batal|tidak jadi meeting|meeting batal|ga jadi|gak jadi)$/.test(f)) return { kind: 'skip', notes: '' };
  if (/^(nanti|nanti ya|nanti dulu|belum|belum ada|nanti saya kabari|nanti aku kabari|ntar|ntar ya)$/.test(f)) return { kind: 'later', notes: '' };
  if (t.length < 3) return null;
  if (f.length < 16 && /^(oke|ok|okay|siap|sip|makasih|terima kasih|thanks|baik|iya|ya|noted)( |$)/.test(f)) return null;      // a thank-you is not the notes
  return { kind: 'notes', notes: t.slice(0, 4000) };
}

export const MOM_SYSTEM = `Kamu Fefe, asisten pribadi tim sales. Rapikan catatan meeting dari sales menjadi notulen (MoM) singkat dalam Bahasa Indonesia. Pakai hanya isi catatan; jangan menambah fakta, angka atau janji yang tidak disebut.
Format teks biasa (tanpa tanda bintang), maksimal 900 karakter:
Ringkasan: 1 sampai 2 kalimat.
Keputusan: poin singkat (tulis "-" kalau tidak ada).
Tindak lanjut: poin singkat dengan siapa dan kapan kalau disebut (tulis "-" kalau tidak ada).
Saran tahap pipeline: satu dari New Lead, Contacted, Qualified, Warm, Meeting Offered, Meeting Booked, Meeting Offline, Meeting Done, Negotiation, Cold Leads, Lost, dan alasannya dalam beberapa kata.`;
