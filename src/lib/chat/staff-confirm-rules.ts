/**
 * "Is this the same client?" When Fefe is not sure a lead or a meeting is about a client we already have, she asks the salesperson instead of guessing, so no
 * double lead or client is made. Pure rules, so they are tested.
 */
import type { Match } from './staff-lead';

export interface Candidate { id: string; no: number | null; name: string; pic: string }

/** A match that is sure enough to use without asking: a phone number, the store or the brand written the same (score 85 or more) and nothing else as good. */
export const SURE_SCORE = 85;

/**
 * The clients to ask about, or null when Fefe can go on by herself.
 *  - nothing alike: a new lead, no question;
 *  - one clear match (phone, store or brand): use it;
 *  - an UPDATE of a lead ("pindah ke Warm") and one likely person (score 70 or more): use it;
 *  - anything else (only the person's name looks alike, or several fit): ask, with up to 3 candidates.
 */
export function needsConfirm(matches: Match[], opts: { update: boolean }): Match[] | null {
  if (!matches.length) return null;
  const top = matches[0];
  const tied = matches.filter((m) => m.score === top.score).length > 1;
  if (!tied && top.score >= SURE_SCORE) return null;
  if (!tied && opts.update && top.score >= 70) return null;
  return matches.slice(0, 3);
}

export const toCandidate = (m: Match): Candidate => ({ id: m.client.id, no: (m.client as any).client_no ?? null, name: String(m.client.name || ''), pic: String(m.client.contact_name || '') });

/** The question, in the team's words. */
export function confirmQuestion(cands: Candidate[]): string {
  const blocks = cands.map((c) => [`Client ID: ${c.no ?? '-'}`, `Brand: ${c.name || '-'}`, `Nama PIC: ${c.pic || '-'}`].join('\n'));
  return [
    cands.length > 1 ? 'Apakah ini sama dengan salah satu client kita?' : 'Apakah ini sama dengan client kita?',
    '',
    blocks.join('\n\n'),
    '',
    cands.length > 1 ? 'Balas Client ID yang benar, atau TIDAK kalau ini lead baru.' : 'Balas YA kalau sama, TIDAK kalau ini lead baru, atau kirim Client ID yang benar.',
  ].join('\n');
}

export type ConfirmAnswer = { kind: 'new' } | { kind: 'client'; clientId: string } | { kind: 'clientNo'; no: number } | { kind: 'which' };

/** The salesperson's short answer. Null when the message is not an answer (it is then handled as any other message). */
export function readConfirmAnswer(text: string | null | undefined, cands: Candidate[]): ConfirmAnswer | null {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 40) return null;
  const t = raw.toLowerCase().replace(/[^a-z0-9# ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(tidak|tidak sama|nggak|enggak|ngga|ga|gak|bukan|bukan sama|beda|lain|baru|new|lead baru|client baru|klien baru)( kak| ya| deh)?$/.test(t)) return { kind: 'new' };
  if (/^(ya|iya|yes|y|sama|betul|benar|bener|yup|ya sama|iya sama|sama kak|iya kak|ya kak)$/.test(t)) return cands.length === 1 ? { kind: 'client', clientId: cands[0].id } : { kind: 'which' };
  const id = /^(?:client id|id|klien|client)?\s*#?\s*(\d{3,6})$/.exec(t);
  if (id) { const no = Number(id[1]); const c = cands.find((x) => x.no === no); return c ? { kind: 'client', clientId: c.id } : { kind: 'clientNo', no }; }
  const ix = /^([1-3])$/.exec(t);
  if (ix && cands.length > 1 && Number(ix[1]) <= cands.length) return { kind: 'client', clientId: cands[Number(ix[1]) - 1].id };
  return null;
}
