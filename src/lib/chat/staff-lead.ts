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

export const TEMPLATE = ['Hi Fefe', 'Nama Brand:', 'No Hp: 628', 'Nama Toko:', 'Nama PIC:', 'Alamat:', 'Kategori:', 'Pipeline:'].join('\n');

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
  if (out.phone.replace(/\D/g, '').length <= 4) out.phone = '';        // the template's "No Hp: 628" left as it is
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

// ---------------------------------------------------------------- free text: "Hi fefe, masukkan nomor bu Tati brand furniture 0812..."
export const AI_SYSTEM = `Kamu membaca pesan WhatsApp dari anggota tim sales kami kepada asisten bernama Fefe. Pesan itu meminta Fefe memasukkan lead baru atau mengubah lead yang sudah ada di pipeline. Ambil datanya. Jangan mengarang: kalau sesuatu tidak disebut, kosongkan.
Balas HANYA dengan satu objek JSON, tanpa teks lain:
{"aksi":"buat","brand":"","toko":"","pic":"","alamat":"","kategori":"","hp":"","pipeline":"","catatan":""}
- "aksi": "buat" kalau memasukkan orang atau toko baru, "ubah" kalau mengubah tahap atau data lead yang sudah ada, "tidak_jelas" kalau pesannya bukan permintaan seperti itu.
- "brand" nama merek. "toko" nama toko di marketplace. "pic" nama orang yang dihubungi (misal "Bu Tati"). "kategori" jenis produk atau bisnis (misal furniture, fashion). "hp" nomor telepon atau WA. "alamat" alamat. "catatan" hal lain yang perlu dicatat.
- "pipeline": salah satu dari New Lead, Contacted, Qualified, Warm, Meeting Offered, Meeting Booked, Meeting Done, Negotiation, Cold Leads, Lost. Kosong kalau tidak diminta.
- "brand furniture" atau "toko fashion" artinya kategorinya furniture atau fashion, bukan nama merek.
- Nomor telepon hanya di "hp", jangan di kolom lain.`;

/** Reads the model's JSON (it may come wrapped in text). Null when there is none. */
export function parseAiLead(text: string): { action: 'create' | 'update' | 'unclear'; fields: LeadFields } | null {
  const m = /\{[\s\S]*\}/.exec(String(text ?? ''));
  if (!m) return null;
  let j: any;
  try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const s = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const action = j.aksi === 'buat' ? 'create' : j.aksi === 'ubah' ? 'update' : 'unclear';
  const fields: LeadFields = { brand: s(j.brand), store: s(j.toko), pic: s(j.pic), address: s(j.alamat), category: s(j.kategori), stage: s(j.pipeline), phone: s(j.hp), note: s(j.catatan) };
  if (fields.phone.replace(/\D/g, '').length <= 4) fields.phone = '';
  return { action, fields };
}

/** The message without its "Hi Fefe" greeting. */
export const restOf = (text: string) => String(text ?? '').replace(/^\s*(hi|hai|halo|hello|hey)\s+fefe\b[\s,.:!-]*/i, '').trim();

/** A phone number written anywhere in a text ("62816987122", "0812-3456-7890", "+62 812 3456 7890"), as 62..., or empty. */
export function phoneIn(text: string): string {
  const m = /(?:\+?62|0)8[\d\s-]{7,13}\d|\b8\d{8,12}\b/.exec(String(text ?? ''));
  return m ? normalizePhone(m[0]) : '';
}

export const STAGE_CHOICES = 'New Lead, Contacted, Qualified, Warm, Meeting Offered, Meeting Booked, Meeting Done, Negotiation, Cold Leads, Lost';

export const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
