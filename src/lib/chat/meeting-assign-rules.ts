/**
 * The meeting assignment by WhatsApp. When a lead books the free consultation, Herlan is asked who handles it (Herlan, Velly or both) and answers with 1, 2 or 3
 * (or the name). Pure parts here, so the rules are tested.
 */
export type AssignPick = 'herlan' | 'velly' | 'both';

/** A short code for a meeting, so an answer can name it when several are waiting: "M7K2". */
export const meetCode = (id: string) => 'M' + String(id || '').replace(/-/g, '').slice(0, 4).toUpperCase();

/** Herlan's answer: "1", "2", "3", "Herlan", "Velly", "berdua", "M7K2 2". The code is optional. */
export function readAssignReply(text: string | null | undefined): { pick: AssignPick; code: string } | null {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 60) return null;
  const code = (/\bM([0-9A-F]{4})\b/i.exec(raw) || [])[0]?.toUpperCase() ?? '';
  const t = raw.replace(/\bM[0-9A-F]{4}\b/gi, ' ').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(3|berdua|dua duanya|duaduanya|keduanya|both|herlan velly|herlan dan velly|herlan sama velly|herlan velly berdua|velly herlan|velly dan herlan)$/.test(t)) return { pick: 'both', code };
  if (/^(1|herlan|saya|aku|gue|gw|saya aja|aku aja|herlan aja|saya sendiri)$/.test(t)) return { pick: 'herlan', code };
  if (/^(2|velly|velly aja|vely|veli)$/.test(t)) return { pick: 'velly', code };
  return null;
}

export const askText = (m: { code: string; lead: string; store: string | null; when: string; meetUrl: string | null }) => [
  `Ada meeting baru dari chat: ${m.lead}${m.store ? ` (${m.store})` : ''}`,
  m.when,
  m.meetUrl ? `Meet: ${m.meetUrl}` : '',
  '',
  'Siapa yang pegang kak?',
  '1 = Herlan',
  '2 = Velly',
  '3 = Berdua',
  '',
  `Balas angkanya saja ya. Kode: ${m.code}`,
].filter((x, i, a) => x !== '' || (a[i - 1] !== '' && i > 0)).join('\n');

export const assignedText = (names: string[], m: { lead: string; when: string; meetUrl: string | null }, emailed: boolean) =>
  `Siap kak, meeting ${m.lead} (${m.when}) dipegang ${names.join(' dan ')}.${emailed ? ' Undangan Google Calendar sudah dikirim ke Gmail-nya.' : ' (Undangan Google Calendar belum terkirim: cek koneksi Google di Jadwal.)'}`;

export const youAreAssignedText = (by: string, m: { lead: string; store: string | null; when: string; meetUrl: string | null }) =>
  [`${by} menunjuk kamu untuk pegang meeting:`, `${m.lead}${m.store ? ` (${m.store})` : ''}`, m.when, m.meetUrl ? `Meet: ${m.meetUrl}` : '', 'Undangannya ada di Google Calendar kamu.'].filter(Boolean).join('\n');
