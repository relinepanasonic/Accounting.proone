/**
 * Follow-up nudges: a lead who chatted but never booked the free consultation, and went quiet after our last answer, gets one to three short
 * WhatsApp messages (for example a day and three days after their last message), each with three free times, numbered. Pure, so the rules are tested.
 * The count starts again when the lead writes again, but a lead never gets more than LIFETIME_MAX nudges in total.
 */
import { slotLabel } from './meet-rules';

export interface NudgeSettings { enabled: boolean; hours: number[] }
export const NUDGE_DEFAULTS: NudgeSettings = { enabled: false, hours: [24, 72, 168] };
export const LIFETIME_MAX = 4;
/** A nudge that is late (the clock was off, or the setting changed) by more than this is skipped, not sent days later. */
export const LATE_MS = 48 * 3600000;

/** "24,72" or [24, 72] -> [24, 72]: whole hours from 1 to 168 (a week), sorted, at most 3. */
export function parseHours(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  return [...new Set(list.map((x) => Math.round(Number(String(x).trim()))).filter((n) => Number.isFinite(n) && n >= 1 && n <= 168))].sort((a, b) => a - b).slice(0, 3);
}

export interface NudgeRecord { inboundAt: string | null; sent: number; total: number }

/**
 * Which nudge (0, 1 or 2) is due now for a chat whose lead last wrote at `lastIn`, or null. The count is per silence: when the lead wrote again
 * after our last nudge, it starts from the first one again.
 */
export function dueNudge(hours: number[], lastIn: Date, rec: NudgeRecord | null, now: Date): number | null {
  if (!hours.length) return null;
  if ((rec?.total ?? 0) >= LIFETIME_MAX) return null;
  const sent = rec && rec.inboundAt && new Date(rec.inboundAt).getTime() === lastIn.getTime() ? rec.sent : 0;
  if (sent >= hours.length) return null;
  const quiet = now.getTime() - lastIn.getTime();
  const at = hours[sent] * 3600000;
  if (quiet < at || quiet > at + LATE_MS) return null;
  return sent;
}

const firstName = (name: string | null | undefined) => {
  const f = String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || '';
  return /^\d+$/.test(f) ? '' : f;
};

/** The nudge: friendly, short, about the free consultation, three numbered times, and the way out (STOP). */
export function nudgeText(index: number, name: string | null | undefined, slots: Date[], minutes: number): string {
  const who = firstName(name) ? `kak ${firstName(name)}` : 'kak';
  // Three messages, a day, three days and a week after the last answer. Each is easy to ignore: no pressure, no guilt, no "why did you not answer",
  // something useful in the second, and a polite goodbye in the third.
  const open = [
    `Hi ${who}, ini Fefe dari Prof Toko Online. Kalau kemarin kakak sempat sibuk, santai aja ya. Kapan pun kakak siap, tim ahli kami bisa bantu cek toko kakak lewat konsultasi gratis ${minutes} menit (Google Meet), tanpa kewajiban apa pun.`,
    `Hi ${who}, ada info singkat: tokonya sepi sering bukan karena produknya, tapi karena iklan dan pengaturannya belum pas. Kalau kakak penasaran bagian mana di toko kakak yang bisa diperbaiki, konsultasi gratis ${minutes} menit kami masih terbuka.`,
    `Hi ${who}, ini pesan terakhir dari Fefe supaya tidak mengganggu ya. Konsultasi gratis ${minutes} menit tetap terbuka kapan pun kakak butuh. Terima kasih sudah mampir, semoga tokonya makin ramai!`,
  ][Math.min(index, 2)];
  const nums = slots.map((_, i) => String(i + 1));
  const choice = nums.length > 1 ? `${nums.slice(0, -1).join(', ')} atau ${nums[nums.length - 1]}` : nums[0];
  return [open, '', 'Waktu yang masih kosong:', ...slots.map((d, i) => `${i + 1}. ${slotLabel(d)}`), '', `Balas angkanya ya kak (${choice}). Balas STOP kalau tidak mau dihubungi lagi.`].join('\n');
}

/** A reply to a nudge that picks one of the numbered times: "2", "no 2", "yang 2 aja kak". */
export function readPick(text: string, offered: number): number | null {
  const t = String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const m = /^(?:no |nomor |nomer |yang |pilih |opsi )?([1-9])(?: aja| saja| ya| kak| min)*$/.exec(t);
  return m && Number(m[1]) <= offered ? Number(m[1]) : null;
}

/** How long a nudge's numbered times can be picked by number. */
export const OFFER_VALID_MS = 72 * 3600000;
