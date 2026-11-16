import { isForward } from '@/lib/sales/flow';
import { doNotContact } from './do-not-contact';

/**
 * Which pipeline stage a chat's lead is in, decided from what the lead did and said. Pure, so the rules are tested.
 * Actions first (we know the name and the store, the lead replied, we offered times, we sent the deck), trigger words second (price, "mau daftar",
 * "tidak jadi"). The highest stage that applies wins, and the caller only ever moves a deal FORWARD (Lost is the last stage).
 */
export interface StageWords { warm: string[]; negotiation: string[]; lost: string[] }

/** Editable in AI Kamus > Bot script & settings. Matched as whole words or phrases, ignoring case and punctuation. */
export const DEFAULT_WORDS: StageWords = {
  warm: ['harga', 'berapa', 'biaya', 'tarif', 'paket', 'promo', 'diskon', 'deck', 'proposal', 'company profile', 'portofolio', 'cara kerja', 'caranya', 'gimana cara', 'mau coba', 'tertarik', 'minat', 'cocok'],
  negotiation: ['mau daftar', 'mau order', 'mau deal', 'mau bayar', 'siap bayar', 'transfer', 'minta invoice', 'minta penawaran', 'bisa nego', 'nego', 'kurangin', 'bisa kurang', 'ambil paket', 'jadi ambil', 'deal'],
  lost: ['tidak jadi', 'ga jadi', 'gak jadi', 'nggak jadi', 'belum minat', 'ga dulu', 'gak dulu', 'nanti dulu', 'sudah ada yang lain'],
};

const norm = (t: string) => ` ${String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()} `;

/** "harga, paket ; Promo" -> ["harga", "paket", "promo"]. Whole words or short phrases, at most 40 each. */
export function parseWords(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,;\n]/);
  return [...new Set(list.map((x) => norm(String(x)).trim()).filter((x) => x.length >= 2 && x.length <= 40))].slice(0, 60);
}

/** The saved words, or the defaults for a group that was never edited. */
export function wordsOf(saved: unknown): StageWords {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof StageWords, unknown>>;
  const pick = (k: keyof StageWords) => (s[k] === undefined ? DEFAULT_WORDS[k] : parseWords(s[k]));
  return { warm: pick('warm'), negotiation: pick('negotiation'), lost: pick('lost') };
}

/** Does the text contain one of the words (as whole words)? */
export const hasWord = (text: string, words: string[]) => { const t = norm(text); return words.some((w) => t.includes(` ${w} `)); };

export interface StageFacts {
  hasName: boolean; hasStore: boolean;
  replied: boolean;          // the lead wrote at least twice (an answer to something we said)
  text: string;              // the lead's latest message
  offeredTimes: boolean;     // we sent free times (the bot, a follow-up, or a salesperson)
  deckSent: boolean;
}

export interface StageCall { stage: string; why: string }

/**
 * The stage the lead has reached, as far as the chat shows. Returns the highest that applies, with the reason (written in the chat's team note).
 * Booking, the meeting and the invoice are not decided here: they come from the meeting and the invoice flow.
 */
export function stageFor(f: StageFacts, w: StageWords): StageCall {
  if (doNotContact(f.text)) return { stage: 'Lost', why: 'kakak minta tidak dihubungi lagi / tidak berminat' };
  if (hasWord(f.text, w.lost)) return { stage: 'Cold Case', why: 'kakak bilang belum jadi / belum minat' };
  if (hasWord(f.text, w.negotiation)) return { stage: 'Negotiation', why: 'kakak minta daftar / invoice / nego' };
  if (f.offeredTimes) return { stage: 'Meeting Offered', why: 'waktu konsultasi sudah ditawarkan' };
  if (f.deckSent) return { stage: 'Warm', why: 'deck dikirim' };
  if (hasWord(f.text, w.warm)) return { stage: 'Warm', why: 'kakak tanya harga / paket / deck' };
  if (f.hasName && f.hasStore) return { stage: 'Qualified', why: 'nama dan toko sudah diketahui' };
  if (f.replied) return { stage: 'Contacted', why: 'kakak membalas' };
  return { stage: 'Lead', why: 'chat pertama' };
}

export interface LeadOwner { id: string; name: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The rotation list as saved: only real ids, each once, at most 10, a name for each. */
export function cleanOwners(raw: unknown): LeadOwner[] {
  const seen = new Set<string>();
  const out: LeadOwner[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const id = String((x as any)?.id ?? '').toLowerCase();
    if (!UUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: String((x as any)?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sales' });
  }
  return out.slice(0, 10);
}

/**
 * Who gets the next new lead: whoever in the list got the FEWEST new leads in the last 30 days (a tie goes to the one higher in the list), so every
 * salesperson gets the same number. `counts` = new leads per salesperson id. Null when the list is empty.
 */
export function nextOwner(owners: LeadOwner[], counts: Record<string, number>): LeadOwner | null {
  let best: LeadOwner | null = null;
  for (const o of owners) if (!best || (counts[o.id] ?? 0) < (counts[best.id] ?? 0)) best = o;
  return best;
}

/** Should this call move the deal? Forward only, except that a lead who writes again after Lost comes back as Contacted (handled by the caller). */
export const movesDeal = (current: string, call: StageCall) => isForward(current, call.stage);
