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
}
export const MEET_DEFAULTS: MeetSettings = { enabled: false, days: [1, 2, 3, 4, 5], from: '10:00', to: '17:00', minutes: 30, noticeHours: 3, daysAhead: 7 };

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
