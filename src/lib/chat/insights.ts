import { hasWord } from './stage-rules';

/**
 * What clients ask in the chats, for the BOD: which package is asked about most, what worries them, and what they say they need.
 * Counted from the leads' own messages by plain keyword lists (so every number can be checked), not guessed by an AI. Pure, so it is tested.
 * A message can match several packages or concerns; each is counted once per chat ("chats") and once per message ("mentions").
 */
export interface Topic { key: string; label: string; words: string[] }

/** The packages and offers, from the sales script. A chat that says one of the words is asking about that package. */
export const PACKAGES: Topic[] = [
  { key: 'optimize', label: 'Paket Optimize Shopee', words: ['optimize', 'optimasi', 'optimalisasi', 'kelola toko', 'dikelola', 'gmv max', 'paket optimize'] },
  { key: 'meta', label: 'Paket Meta Ads', words: ['meta ads', 'iklan meta', 'facebook ads', 'fb ads', 'iklan instagram', 'iklan facebook'] },
  { key: 'tiktok', label: 'Paket TikTok', words: ['tiktok', 'tik tok', 'tokopedia', 'tiktok shop', 'konten'] },
  { key: 'friends', label: 'Friends Order', words: ['friends order', 'fo', 'order awal', 'toko baru', 'order pertama', 'pesanan awal'] },
  { key: 'juragan', label: 'Paket Juragan', words: ['juragan', 'paket juragan'] },
  { key: 'iklan', label: 'Iklan marketplace', words: ['iklan', 'ads', 'roas', 'biaya iklan', 'beriklan', 'promosi'] },
  { key: 'konsul', label: 'Konsultasi gratis', words: ['konsultasi', 'konsul', 'meeting', 'zoom', 'google meet', 'jadwal'] },
  { key: 'deck', label: 'Deck / company profile', words: ['deck', 'proposal', 'company profile', 'portofolio', 'profile', 'katalog'] },
];

/** What worries clients, in their own words. */
export const CONCERNS: Topic[] = [
  { key: 'harga', label: 'Harga dan biaya', words: ['harga', 'biaya', 'tarif', 'berapa', 'mahal', 'murah', 'diskon', 'promo', 'budget'] },
  { key: 'hasil', label: 'Hasil dan jaminan omzet', words: ['hasil', 'jaminan', 'garansi', 'omzet naik', 'naik omzet', 'terbukti', 'bukti', 'berhasil', 'efektif', 'janji'] },
  { key: 'sepi', label: 'Toko sepi / penjualan turun', words: ['sepi', 'turun', 'tidak laku', 'gak laku', 'ga laku', 'nggak laku', 'sepi pembeli', 'omzet turun', 'penjualan turun', 'stuck', 'mandek'] },
  { key: 'iklan', label: 'Iklan boros / ROAS rendah', words: ['boros', 'roas', 'rugi', 'bakar uang', 'iklan mahal', 'biaya iklan', 'iklan tidak', 'iklan gak', 'iklan ga'] },
  { key: 'cara', label: 'Cara kerja dan proses', words: ['cara kerja', 'caranya', 'gimana cara', 'bagaimana cara', 'prosesnya', 'proses', 'tahapan', 'langkah', 'dikerjakan', 'dapat apa', 'termasuk apa'] },
  { key: 'durasi', label: 'Durasi dan kontrak', words: ['kontrak', 'durasi', 'berapa lama', 'minimal', 'sebulan', 'per bulan', 'bulanan', 'berhenti', 'putus'] },
  { key: 'bayar', label: 'Pembayaran dan cicilan', words: ['bayar', 'pembayaran', 'cicil', 'cicilan', 'dp', 'transfer', 'termin', 'invoice', 'tagihan'] },
  { key: 'percaya', label: 'Kepercayaan dan legalitas', words: ['percaya', 'penipuan', 'tipu', 'legal', 'resmi', 'terpercaya', 'review', 'testimoni', 'portofolio', 'klien lain', 'client lain'] },
  { key: 'akun', label: 'Akun, penalti dan masalah toko', words: ['banned', 'diblokir', 'penalti', 'penalty', 'suspend', 'dibatasi', 'akun', 'rating', 'komplain', 'retur'] },
  { key: 'saingan', label: 'Pesaing dan harga pasar', words: ['kompetitor', 'pesaing', 'saingan', 'toko lain', 'seller lain', 'agensi lain', 'agency lain'] },
  { key: 'teknis', label: 'Bantuan teknis toko', words: ['foto produk', 'deskripsi', 'judul produk', 'etalase', 'katalog', 'upload produk', 'stok', 'ongkir', 'voucher', 'flash sale'] },
  { key: 'tahu', label: 'Belum tahu apa yang dibutuhkan', words: ['bingung', 'belum tahu', 'tidak tahu', 'gak tahu', 'ga tahu', 'saran', 'rekomendasi', 'cocok', 'pilih paket', 'paket apa'] },
];

export interface InMessage { group_id: string; body: string | null; sent_at: string }
export interface TopicCount { key: string; label: string; chats: number; mentions: number; examples: string[] }
export interface Insights {
  chats: number; messages: number;
  packages: TopicCount[]; concerns: TopicCount[];
  unmatched: number;                     // messages that fit no concern
}

const clean = (t: string) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** A short, readable example of what a client wrote (never a phone number or a link). */
export function exampleOf(text: string): string {
  const t = clean(text).replace(/https?:\/\/\S+/gi, '').replace(/\+?\d[\d\s().-]{7,}\d/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 140 ? `${t.slice(0, 137).trimEnd()}...` : t;
}

function count(topics: Topic[], list: Array<{ group_id: string; text: string }>): { rows: TopicCount[]; matched: Set<number> } {
  const matched = new Set<number>();
  const rows = topics.map((tp) => {
    const chats = new Set<string>(); let mentions = 0; const examples: string[] = [];
    list.forEach((m, i) => {
      if (!hasWord(m.text, tp.words)) return;
      matched.add(i); chats.add(m.group_id); mentions++;
      const ex = exampleOf(m.text);
      if (ex.length >= 12 && examples.length < 3 && !examples.includes(ex)) examples.push(ex);
    });
    return { key: tp.key, label: tp.label, chats: chats.size, mentions, examples };
  });
  return { rows: rows.filter((r) => r.mentions > 0).sort((a, b) => b.chats - a.chats || b.mentions - a.mentions || a.label.localeCompare(b.label)), matched };
}

/** The leads' messages of the period, counted into packages and concerns. Empty messages and photos are skipped. */
export function analyze(messages: InMessage[]): Insights {
  const list = messages.map((m) => ({ group_id: m.group_id, text: clean(m.body || '') })).filter((m) => m.text.length >= 2);
  const pk = count(PACKAGES, list);
  const cn = count(CONCERNS, list);
  return { chats: new Set(list.map((m) => m.group_id)).size, messages: list.length, packages: pk.rows, concerns: cn.rows, unmatched: list.length - cn.matched.size };
}

export interface NeedCount { need: string; chats: number }
/** What leads told the bot they need (the "need" the bot wrote down), the same wording grouped, most common first. */
export function needsOf(leads: Array<{ need?: string | null }>, max = 8): NeedCount[] {
  const by = new Map<string, NeedCount>();
  for (const l of leads) {
    const raw = clean(l.need || '');
    if (raw.length < 3) continue;
    const key = raw.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
    if (!key) continue;
    const cur = by.get(key) || { need: raw.slice(0, 120), chats: 0 };
    cur.chats++;
    by.set(key, cur);
  }
  return [...by.values()].sort((a, b) => b.chats - a.chats || a.need.localeCompare(b.need)).slice(0, max);
}

/** The text the AI reads to write the summary for the BOD: the counts, the examples and the needs. Short, so it is cheap and fast. */
export function summaryInput(i: Insights, needs: NeedCount[], days: number): string {
  const top = (rows: TopicCount[]) => rows.slice(0, 6).map((r) => `- ${r.label}: ${r.chats} chat, ${r.mentions} pesan. Contoh: ${r.examples.map((e) => `"${e}"`).join(' | ') || '-'}`).join('\n') || '- (belum ada)';
  return [
    `Periode: ${days} hari terakhir. ${i.chats} chat, ${i.messages} pesan dari calon client.`,
    'PAKET YANG DITANYAKAN:', top(i.packages),
    'KEKHAWATIRAN CLIENT:', top(i.concerns),
    'KEBUTUHAN YANG DISEBUT KE BOT:', needs.map((n) => `- ${n.need} (${n.chats} chat)`).join('\n') || '- (belum ada)',
  ].join('\n');
}

export const SUMMARY_SYSTEM = [
  'Kamu analis yang membantu direksi (BOD) Prof Toko Online, agensi yang mengelola toko online di Shopee, TikTok dan Meta Ads.',
  'Dari data chat calon client di bawah, tulis ringkasan dalam bahasa Indonesia yang singkat dan konkret untuk direksi:',
  '1. Paket apa yang paling banyak ditanya dan apa artinya.',
  '2. Apa kekhawatiran utama client dan bagaimana tim sebaiknya menjawabnya.',
  '3. Apa yang sebenarnya dibutuhkan client.',
  '4. Satu sampai tiga tindakan yang disarankan minggu ini.',
  'ATURAN: pakai HANYA data yang diberikan. Jangan mengarang angka atau kejadian. Kalau data masih sedikit (kurang dari 10 chat), katakan itu di kalimat pertama dan jangan menarik kesimpulan besar.',
  'Format: teks biasa, 4 bagian bernomor, masing-masing 1 sampai 3 kalimat. Tanpa Markdown tebal, tanpa tabel.',
].join('\n');
