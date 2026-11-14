/**
 * Free consultations with the expert team: which times can be offered, and how they are written for the lead. Pure (no database, no Google),
 * so the rules are tested. All times are Jakarta time (WIB, UTC+7, no daylight saving).
 */
export interface MeetSettings {
  enabled: boolean;
  days: number[];          // 0 = Sunday ... 6 = Saturday
  from: string;            // "10:00"
  to: string;              // "17:00"
  minutes: number;         // length of one meeting
  noticeHours: number;     // the earliest bookable time is now + this
  daysAhead: number;       // how far ahead times are offered
  ownerId?: string | null; // the salesperson who takes consultations when the chat has nobody assigned (shown in the ERP's Meetings)
  ownerName?: string | null;
}
export const MEET_DEFAULTS: MeetSettings = { enabled: false, days: [1, 2, 3, 4, 5], from: '10:00', to: '17:00', minutes: 30, noticeHours: 3, daysAhead: 7, ownerId: null, ownerName: null };

const WIB = 7 * 3600000;
const mins = (s: string) => { const [a, b] = String(s).split(':').map(Number); return (a || 0) * 60 + (b || 0); };
export const validTime = (s: unknown) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** "1,2,3" -> [1,2,3]; anything else is dropped. */
export const parseDays = (raw: unknown): number[] => [...new Set(String(raw ?? '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();

export interface Busy { start: Date; end: Date }

/** Every free start time from now (plus the notice) for the next `daysAhead` days, inside the hours, not overlapping anything busy. */
export function freeSlots(s: MeetSettings, now: Date, busy: Busy[] = []): Date[] {
  const out: Date[] = [];
  const earliest = now.getTime() + s.noticeHours * 3600000;
  const step = Math.max(15, s.minutes);
  // midnight (Jakarta) of today, as a UTC instant
  const local = new Date(now.getTime() + WIB);
  const day0 = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - WIB;
  for (let d = 0; d < s.daysAhead; d++) {
    const dayStart = day0 + d * 86400000;
    const weekday = new Date(dayStart + WIB).getUTCDay();
    if (!s.days.includes(weekday)) continue;
    for (let m = mins(s.from); m + s.minutes <= mins(s.to); m += step) {
      const start = dayStart + m * 60000;
      const end = start + s.minutes * 60000;
      if (start < earliest) continue;
      if (busy.some((b) => start < b.end.getTime() && end > b.start.getTime())) continue;
      out.push(new Date(start));
    }
  }
  return out;
}

/** A short list to offer in a chat: at most two times a day (a morning and an afternoon one when possible), the soonest days first. */
export function offerSlots(slots: Date[], max = 6): Date[] {
  const byDay = new Map<string, Date[]>();
  for (const s of slots) { const k = dayKey(s); byDay.set(k, [...(byDay.get(k) || []), s]); }
  const out: Date[] = [];
  for (const list of byDay.values()) {
    const morning = list.find((x) => hourOf(x) < 12);
    const afternoon = list.find((x) => hourOf(x) >= 13) ?? list[list.length - 1];
    for (const x of [morning ?? list[0], afternoon]) if (x && !out.some((y) => y.getTime() === x.getTime())) out.push(x);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

const dayKey = (d: Date) => new Date(d.getTime() + WIB).toISOString().slice(0, 10);
const hourOf = (d: Date) => new Date(d.getTime() + WIB).getUTCHours();

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "Senin 17 Nov, jam 10.00 WIB": the way a time is written to a lead. */
export function slotLabel(d: Date): string {
  const l = new Date(d.getTime() + WIB);
  const hh = String(l.getUTCHours()).padStart(2, '0'); const mm = String(l.getUTCMinutes()).padStart(2, '0');
  return `${HARI[l.getUTCDay()]} ${l.getUTCDate()} ${BULAN[l.getUTCMonth()]}, jam ${hh}.${mm} WIB`;
}

/** The slot the model chose, only when it is one of the free times (exact start). */
export function matchSlot(raw: unknown, free: Date[]): Date | null {
  const t = Date.parse(String(raw ?? ''));
  if (!Number.isFinite(t)) return null;
  return free.find((s) => s.getTime() === t) ?? null;
}

/** The ISO time the bot uses to name a slot: "2026-11-17T10:00+07:00". */
export function slotCode(d: Date): string {
  const l = new Date(d.getTime() + WIB);
  return `${l.toISOString().slice(0, 16)}+07:00`;
}

/** What the lead gets once the meeting is booked (added after the bot's own words, so the time and link are always right). */
export function bookedText(start: Date, minutes: number, meetUrl: string | null): string {
  return [`Jadwal konsultasi gratis kakak dengan tim ahli: ${slotLabel(start)} (${minutes} menit).`, meetUrl ? `Link Google Meet: ${meetUrl}` : 'Link meeting akan kami kirim sebelum jadwal ya kak.'].join('\n');
}

/** The reminder an hour before. */
export function reminderText(start: Date, meetUrl: string | null, name: string): string {
  const who = name ? `kak ${name.split(/\s+/)[0]}` : 'kak';
  return [`Hi ${who}, mengingatkan konsultasi gratis dengan tim ahli kami ${slotLabel(start)}, sekitar 1 jam lagi ya.`, meetUrl ? `Link Google Meet: ${meetUrl}` : ''].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- before the meeting: confirm, remind, and the lead's short replies
const firstName = (name: string) => String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || '';
const hi = (name: string) => (firstName(name) ? `Hi kak ${firstName(name)}` : 'Hi kak');
const hhmm = (d: Date) => slotLabel(d).split('jam ')[1]?.replace(' WIB', '') ?? '';

/** An hour before: ask the lead to confirm, or to say they want another time. */
export const confirmText = (start: Date, name: string) =>
  `${hi(name)}, 1 jam lagi konsultasi gratis kakak dengan tim ahli kami (${slotLabel(start)}). Kakak masih bisa hadir?\nBalas YA untuk konfirmasi, atau GANTI kalau mau pindah jadwal.`;

/** 15 minutes before: the link. */
export const remindText = (start: Date, meetUrl: string | null, name: string) =>
  [`${hi(name)}, 15 menit lagi kita mulai ya (jam ${hhmm(start)} WIB).`, meetUrl ? `Link Google Meet: ${meetUrl}` : 'Tim kami akan mengirim link meeting sebentar lagi.'].join('\n');

export const confirmedText = (start: Date) => `Siap kak, terima kasih konfirmasinya. Sampai jumpa jam ${hhmm(start)} WIB ya.`;
export const cancelledText = 'Baik kak, jadwal konsultasinya kami batalkan. Kalau mau atur waktu lagi, kabari saja ya.';
export const noTimeText = 'Baik kak, tim kami akan menghubungi kakak untuk atur waktu yang pas ya.';

/** The other free times, numbered, for a lead who wants to move their meeting. */
export function rescheduleText(slots: Date[]): string {
  const nums = slots.map((_, i) => String(i + 1));
  const choice = nums.length > 1 ? `${nums.slice(0, -1).join(', ')} atau ${nums[nums.length - 1]}` : nums[0];
  return ['Bisa kak, ini waktu yang masih kosong:', ...slots.map((d, i) => `${i + 1}. ${slotLabel(d)}`), `Balas angkanya ya kak (${choice}).`].join('\n');
}

export const movedText = (start: Date, minutes: number, meetUrl: string | null) =>
  [`Sudah kami pindahkan kak. Jadwal baru: ${slotLabel(start)} (${minutes} menit).`, meetUrl ? `Link Google Meet tetap sama: ${meetUrl}` : ''].filter(Boolean).join('\n');

/** The confirmation is only asked when the meeting was booked well before it (more than 70 minutes): otherwise only the 15-minute reminder goes. */
export const shouldAskConfirm = (createdAt: Date, startsAt: Date) => startsAt.getTime() - createdAt.getTime() > 70 * 60000;

export type MeetingReply = { kind: 'confirm' } | { kind: 'reschedule' } | { kind: 'cancel' } | { kind: 'pick'; n: number };

const norm = (t: string) => String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const YES = new Set(['ya', 'iya', 'iyaa', 'iy', 'yes', 'y', 'ok', 'oke', 'okay', 'okey', 'siap', 'sip', 'bisa', 'hadir', 'konfirmasi', 'confirm', 'baik', 'insyaallah', 'insya', 'allah', 'inshaallah', 'kak', 'min', 'saya', 'aku', 'pasti', 'jadi', 'betul', 'benar', 'tentu', 'dong', 'nih', 'terima', 'kasih', 'makasih', 'thanks']);
const YES_CORE = new Set(['ya', 'iya', 'iyaa', 'iy', 'yes', 'y', 'ok', 'oke', 'okay', 'okey', 'siap', 'sip', 'bisa', 'hadir', 'konfirmasi', 'confirm', 'insyaallah', 'inshaallah', 'pasti', 'jadi', 'tentu']);
const RESCHEDULE = [/\bganti\b/, /\breschedule\b/, /\bpindah\b/, /\bubah jadwal\b/, /\bmundur\b/, /\bberhalangan\b/, /\b(ga|gak|ngga|nggak|enggak|engga|tidak|tdk|gk) (bisa|sempat|bs)\b/, /\bgabisa\b/, /\bgakbisa\b/, /\blain waktu\b/, /\bjam lain\b/, /\bhari lain\b/];
const CANCEL = [/\bbatal\b/, /\bbatalkan\b/, /\bcancel\b/, /\b(ga|gak|tidak|nggak|ngga|enggak) jadi\b/];

/**
 * A lead's short reply about their meeting: YA (confirm, only when we asked), GANTI (another time), BATAL (cancel), or a number when we offered
 * numbered times. Only short messages count (6 words or fewer); anything longer goes to the bot or the team as a normal message.
 */
export function readMeetingReply(text: string, state: { askedConfirm: boolean; offered: number }): MeetingReply | null {
  const t = norm(text);
  if (!t || t.split(' ').length > 6) return null;
  if (state.offered > 0) {
    const m = /^(?:no |nomor |nomer |yang |pilih |opsi )?([1-9])(?: aja| saja| ya| kak)*$/.exec(t);
    if (m && Number(m[1]) <= state.offered) return { kind: 'pick', n: Number(m[1]) };
  }
  if (CANCEL.some((r) => r.test(t))) return { kind: 'cancel' };
  if (RESCHEDULE.some((r) => r.test(t))) return { kind: 'reschedule' };
  if (state.askedConfirm) {
    const words = t.split(' ');
    if (words.every((w) => YES.has(w)) && words.some((w) => YES_CORE.has(w))) return { kind: 'confirm' };
  }
  return null;
}
