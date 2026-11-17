/**
 * A team number (a salesperson with a number set in AI Kamus, or the BOD) writes to the sales number: "Hi Fefe" plus the template. Fefe puts the lead in the
 * ERP pipeline, or changes the pipeline of a lead that is already there. Pure parts here, so the rules are tested.
 */
import { normalizePhone } from './sales-team';

export { normalizePhone };

/** "Hi Fefe", "hai fefe", "Halo Fefe,": the start of the message. */
export const isHiFefe = (text: string | null | undefined) => /^\s*(hi|hai|halo|hello|hey)\s+fefe\b/i.test(String(text ?? ''));

/** "Test Fefe": a team number chats with Fefe as a lead, for testing. "Test off" ends it. */
export const isTestOn = (text: string | null | undefined) => /^\s*(test|tes)\s+fefe\s*[.!]*\s*$/i.test(String(text ?? ''));
export const isTestOff = (text: string | null | undefined) => /^\s*(test|tes)\s+(off|selesai|stop)\s*[.!]*\s*$/i.test(String(text ?? '')) || /^\s*(test|tes)\s+fefe\s+(off|selesai)\s*[.!]*\s*$/i.test(String(text ?? ''));

export const TEMPLATE = ['Hi Fefe', 'Nama Brand:', 'Nama Toko:', 'Nama PIC:', 'Alamat:', 'Kategori:', 'Pipeline:'].join('\n');

export interface LeadFields { brand: string; store: string; pic: string; address: string; category: string; stage: string; phone: string; note: string }

const LABELS: Record<string, keyof LeadFields> = {
  'nama brand': 'brand', brand: 'brand', 'nama toko': 'store', toko: 'store', store: 'store', 'nama store': 'store',
  'nama pic': 'pic', pic: 'pic', 'nama kontak': 'pic', kontak: 'pic', alamat: 'address', address: 'address',
  kategori: 'category', kategory: 'category', category: 'category', pipeline: 'stage', stage: 'stage', tahap: 'stage',
  'no wa': 'phone', 'nomor wa': 'phone', 'no hp': 'phone', 'nomor hp': 'phone', wa: 'phone', phone: 'phone', telepon: 'phone', catatan: 'note', note: 'note',
};

/** Reads "Label: value" lines. Unknown lines are ignored; a label with nothing after it is empty. */
export function parseLeadCommand(text: string): LeadFields {
  const out: LeadFields = { brand: '', store: '', pic: '', address: '', category: '', stage: '', phone: '', note: '' };
  for (const raw of String(text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const m = /^\s*([A-Za-z ]{2,20}?)\s*[:=]\s*(.*)$/.exec(raw);
    if (!m) continue;
    const key = LABELS[m[1].toLowerCase().replace(/\s+/g, ' ').trim()];
    if (key) out[key] = m[2].replace(/\s+/g, ' ').trim().slice(0, 300);
  }
  return out;
}

export type StageAsk = { kind: 'none' } | { kind: 'stage'; stage: string } | { kind: 'locked' } | { kind: 'unknown' };

const STAGE_WORDS: Array<[string[], string]> = [
  [['new lead', 'lead', 'lead baru', 'baru', 'new'], 'Lead'],
  [['contacted', 'sudah dihubungi', 'dihubungi'], 'Contacted'],
  [['qualified'], 'Qualified'],
  [['warm'], 'Warm'],
  [['meeting offered', 'offered', 'meeting ditawarkan'], 'Meeting Offered'],
  [['meeting booked', 'booked', 'booking', 'meeting', 'meeting terjadwal'], 'Meeting Booked'],
  [['meeting done', 'done', 'meeting selesai'], 'Meeting Done'],
  [['negotiation', 'nego', 'negosiasi'], 'Negotiation'],
  [['cold', 'cold leads', 'cold lead', 'cold case', 'dingin'], 'Cold Case'],
  [['lost', 'batal', 'tidak jadi'], 'Lost'],
];
const LOCKED_WORDS = ['invoice', 'invoice requested', 'request invoice', 'invoice sent', 'deal', 'active client', 'aktif', 'paid', 'lunas'];

/** The pipeline asked for: a stage a person may pick, one that only the invoice flow sets, one we do not know, or nothing. */
export function stageFromText(raw: string): StageAsk {
  const t = String(raw ?? '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { kind: 'none' };
  for (const [words, stage] of STAGE_WORDS) if (words.includes(t)) return { kind: 'stage', stage };
  if (LOCKED_WORDS.includes(t)) return { kind: 'locked' };
  return { kind: 'unknown' };
}

export const STAGE_CHOICES = 'New Lead, Contacted, Qualified, Warm, Meeting Offered, Meeting Booked, Meeting Done, Negotiation, Cold Leads, Lost';

export const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
