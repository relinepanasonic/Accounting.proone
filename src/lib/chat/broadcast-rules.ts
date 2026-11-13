/**
 * WhatsApp broadcasts sent one by one (never a blast), to protect the sales number: a time window, a daily maximum, a random gap between two
 * messages, a few wordings rotated, and a way out (STOP). Pure, so the rules are tested. Times are Jakarta time.
 */
export interface BcSettings { dailyMax: number; from: string; to: string; gapMin: number; gapMax: number }
export const BC_DEFAULTS: BcSettings = { dailyMax: 40, from: '09:00', to: '19:00', gapMin: 90, gapMax: 240 };

export const STOP_FOOTER = 'Balas STOP kalau tidak mau menerima info lagi ya kak.';
export const STOP_REPLY = 'Siap kak, kami tidak akan mengirim info lagi. Kalau ada yang mau ditanyakan, chat saja kapan pun ya.';

/** The wordings of one broadcast: the message split at lines "---" (at most 5). Rotating them keeps the messages from all being identical. */
export function splitVariants(message: string): string[] {
  return String(message ?? '').replace(/\r\n/g, '\n').split(/\n\s*-{3,}\s*\n/).map((v) => v.trim()).filter(Boolean).slice(0, 5);
}

/** {nama} = the lead's first name ("kak" when unknown). */
export function personalize(text: string, name: string | null | undefined): string {
  const first = String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || '';
  return text.replace(/\{nama\}/gi, first || 'kak').replace(/kak kak/gi, 'kak');
}

/** The message one person gets: their wording (rotated by position), their name, and the STOP line. */
export function composeMessage(message: string, position: number, name: string | null | undefined): string {
  const v = splitVariants(message);
  if (!v.length) return '';
  return `${personalize(v[position % v.length], name)}\n\n${STOP_FOOTER}`;
}

/** "STOP", "stop.", "berhenti", "unsubscribe", "jangan kirim lagi": the person does not want broadcasts. Only the whole message counts. */
export const isStopWord = (text: string | null | undefined) => /^\s*(stop|berhenti|unsubscribe|jangan kirim (info )?lagi|stop kirim)\s*[.!]*\s*$/i.test(String(text ?? ''));

const WIB = 7 * 3600000;
const mins = (s: string) => { const [a, b] = String(s).split(':').map(Number); return (a || 0) * 60 + (b || 0); };
const localMinutes = (d: Date) => { const l = new Date(d.getTime() + WIB); return l.getUTCHours() * 60 + l.getUTCMinutes(); };

/** Midnight in Jakarta of the day `d` is in (to count today's messages). */
export const jakartaMidnight = (d: Date) => { const l = new Date(d.getTime() + WIB); return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - WIB); };

export const inWindow = (d: Date, s: Pick<BcSettings, 'from' | 'to'>) => { const m = localMinutes(d); return m >= mins(s.from) && m < mins(s.to); };

/** When sending may start again: now inside the window; else the next opening (today if it has not opened yet, otherwise tomorrow). */
export function nextOpening(now: Date, s: Pick<BcSettings, 'from' | 'to'>): Date {
  if (inWindow(now, s)) return now;
  const today = jakartaMidnight(now).getTime() + mins(s.from) * 60000;
  return new Date(localMinutes(now) < mins(s.from) ? today : today + 86400000);
}

/** The pause before the next message: random between the two settings (seconds). */
export const nextGapMs = (s: Pick<BcSettings, 'gapMin' | 'gapMax'>, rand = Math.random()) => {
  const lo = Math.min(s.gapMin, s.gapMax), hi = Math.max(s.gapMin, s.gapMax);
  return Math.round((lo + (hi - lo) * rand) * 1000);
};

/** Roughly how many days a broadcast takes: the daily maximum, minus what the window and gaps allow. */
export function daysNeeded(total: number, s: BcSettings): number {
  const perWindow = Math.max(1, Math.floor(((mins(s.to) - mins(s.from)) * 60) / ((s.gapMin + s.gapMax) / 2)));
  return Math.max(1, Math.ceil(total / Math.max(1, Math.min(s.dailyMax, perWindow))));
}

/** After this many failed sends in a row the broadcast pauses itself: the number may be disconnected or limited. */
export const MAX_FAILS_IN_ROW = 3;
