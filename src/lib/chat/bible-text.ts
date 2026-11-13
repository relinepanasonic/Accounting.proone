/**
 * The AI Kamus (the AI's dictionary), pure parts (no database, no network): checking an upload, how the documents are joined into what the AI reads, how old the prices are,
 * and the instruction the model gets to read a Sales Deck. Tested.
 */

export const MAX_DECK_BYTES = 25 * 1024 * 1024;
export const BIBLE_BUCKET = 'ai-bible';
const PER_DOC_CHARS = 14000;
const TOTAL_CHARS = 40000;
export const STALE_DAYS = 30;

export interface BibleDocText { title: string; text: string; text_updated_at: string; active: boolean; status: string }

/** Only a PDF, with a sane name and size, may be uploaded. Returns a message when refused. */
export function checkUpload(fileName: string, size: number): string | null {
  const name = String(fileName || '').trim();
  if (!/\.pdf$/i.test(name)) return 'Please upload the Sales Deck as a PDF (in PowerPoint: File > Save as > PDF).';
  if (!(size > 0)) return 'The file is empty.';
  if (size > MAX_DECK_BYTES) return `The file is too big (max ${MAX_DECK_BYTES / 1024 / 1024} MB). Export the PDF at a smaller size.`;
  return null;
}

/** A safe storage path: <company>/<date>-<random>-<clean name>.pdf. */
export function storagePath(ws: string, fileName: string, now = new Date(), rand = Math.random().toString(36).slice(2, 8)): string {
  const clean = String(fileName || 'deck.pdf').replace(/\.pdf$/i, '').normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'deck';
  return `${ws}/${now.toISOString().slice(0, 10)}-${rand}-${clean}.pdf`;
}

const dmy = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

/**
 * What the AI reads: the bot script first, then every active, ready document with the date its text was last changed (so the AI, and the team,
 * can tell how fresh a price is). Each document is cut at 14,000 characters and the whole at 40,000, with a note when something was cut.
 */
export function buildKnowledge(script: string, docs: BibleDocText[]): string {
  const parts: string[] = [];
  if (script.trim()) parts.push(script.trim());
  const live = docs.filter((d) => d.active && d.status === 'ready' && d.text.trim()).sort((a, b) => b.text_updated_at.localeCompare(a.text_updated_at));
  if (live.length) parts.push('DOKUMEN (Sales Deck dan daftar harga). Kalau ada perbedaan dengan teks di atas, dokumen dengan tanggal terbaru yang benar.');
  for (const d of live) {
    const body = d.text.trim();
    const cut = body.length > PER_DOC_CHARS;
    parts.push(`DOKUMEN: ${d.title} (diperbarui ${dmy(d.text_updated_at)})\n${cut ? `${body.slice(0, PER_DOC_CHARS)}\n[teks dipotong]` : body}`);
  }
  const all = parts.join('\n\n');
  return all.length > TOTAL_CHARS ? `${all.slice(0, TOTAL_CHARS)}\n[teks dipotong]` : all;
}

/** Whole days since `iso` (0 for a future time). */
export const daysSince = (iso: string, now = new Date()) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000));

/** The prices of a document are "old" after 30 days: the page warns, because the AI will keep quoting them. */
export const isStale = (iso: string, now = new Date()) => daysSince(iso, now) >= STALE_DAYS;

export const DECK_SYSTEM = [
  'Kamu membaca Sales Deck sebuah perusahaan jasa (Prof Toko Online) dan menuliskannya sebagai teks biasa yang akan dibaca asisten sales (AI) untuk menjawab calon pelanggan.',
  'Tulis dalam Bahasa Indonesia, teks biasa, tanpa Markdown (tanpa tanda bintang atau pagar).',
  'Isi: 1) tentang perusahaan dan layanan; 2) SETIAP paket atau produk dengan nama persis seperti di deck, HARGA persis (angka dan satuan, per bulan atau sekali bayar), dan apa saja yang termasuk; 3) syarat, durasi kontrak, promo, bonus, dan catatan penting; 4) pertanyaan yang sering muncul bila ada; 5) kontak atau alur pemesanan bila ada.',
  'Salin angka PERSIS seperti tertulis. Jangan membulatkan, jangan menghitung ulang, jangan mengarang. Kalau ada bagian yang tidak terbaca atau gambarnya tidak jelas, tulis [TIDAK TERBACA: halaman N] di tempatnya.',
  'Satu paket satu blok, dimulai dengan nama paket. Jangan menambahkan saran atau penjelasan darimu sendiri.',
].join('\n');

export const DECK_USER = 'Baca seluruh deck ini dan tuliskan isinya sesuai instruksi.';

export const ASK_SYSTEM = (knowledge: string) => [
  'Kamu membantu tim sales Prof Toko Online menjawab pertanyaan tentang paket, harga, dan layanan.',
  'Jawab HANYA dari PENGETAHUAN di bawah, singkat dan jelas, Bahasa Indonesia. Sebut nama paket dan harga persis seperti tertulis.',
  'Kalau jawabannya tidak ada di PENGETAHUAN, katakan terus terang: "Itu belum ada di AI Kamus." Jangan mengarang.',
  '',
  'PENGETAHUAN',
  knowledge.trim() || '(kosong)',
].join('\n');
