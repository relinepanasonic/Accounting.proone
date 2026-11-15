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

export interface DayCount { day: string; chats: number; messages: number }
/** Per Jakarta day, the last `days` days up to today: how many leads wrote, and how many messages. */
export function dailyOf(messages: InMessage[], days: number, now: Date): DayCount[] {
  const key = (d: Date) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: key(new Date(now.getTime() - i * 86400000)), chats: 0, messages: 0 });
  const at = new Map(out.map((d, i) => [d.day, i]));
  const seen = new Map<string, Set<string>>();
  for (const m of messages) {
    if (clean(m.body || '').length < 2) continue;
    const day = key(new Date(m.sent_at)); const i = at.get(day);
    if (i === undefined) continue;
    out[i].messages++;
    if (!seen.has(day)) seen.set(day, new Set());
    seen.get(day)!.add(m.group_id);
  }
  for (const [day, set] of seen) out[at.get(day)!].chats = set.size;
  return out;
}

/** The text the AI reads to write the summary for the BOD: the counts, the examples, the needs and the days. Short, so it is cheap and fast. */
export function summaryInput(i: Insights, needs: NeedCount[], days: number, daily: DayCount[] = []): string {
  const top = (rows: TopicCount[]) => rows.slice(0, 6).map((r) => `- ${r.label}: ${r.chats} chat, ${r.mentions} pesan. Contoh: ${r.examples.map((e) => `"${e}"`).join(' | ') || '-'}`).join('\n') || '- (belum ada)';
  return [
    `Periode: ${days} hari terakhir. ${i.chats} chat, ${i.messages} pesan dari calon client. ${i.unmatched} pesan tidak cocok dengan tema kekhawatiran mana pun.`,
    'PAKET YANG DITANYAKAN:', top(i.packages),
    'KEKHAWATIRAN CLIENT:', top(i.concerns),
    'KEBUTUHAN YANG DISEBUT KE BOT:', needs.map((n) => `- ${n.need} (${n.chats} chat)`).join('\n') || '- (belum ada)',
    daily.length ? `CHAT PER HARI (tanggal: chat/pesan):\n${daily.map((d) => `- ${d.day}: ${d.chats}/${d.messages}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

export const PICS = ['Sales', 'Admin', 'Advertiser', 'Tim Konten', 'Founder / BOD'] as const;
export interface InsightAction { action: string; pic: string; why: string }
/** What the BOD reads: a short executive paragraph, the points behind it, and the actions with who does them (the shape of the Product & Inquiry Intelligence report). */
export interface BodSummary { executive: string; insights: string[]; actions: InsightAction[] }

export const SUMMARY_SYSTEM = [
  'Kamu analis yang menyusun "Laporan Insight Chat" untuk direksi (BOD) Prof Toko Online, agensi yang mengelola toko online di Shopee, TikTok dan Meta Ads.',
  'Dari data chat calon client di bawah, tulis dalam bahasa Indonesia yang formal tapi mudah dipahami. Jawab HANYA dengan satu objek JSON:',
  '{"executive": "...", "insights": ["...", "..."], "actions": [{"action": "...", "pic": "...", "why": "..."}]}',
  '- executive: satu paragraf 4 sampai 6 kalimat. Sebut jumlah chat dan pesan, paket yang paling banyak ditanya, kekhawatiran utama, kebutuhan client, dan hari tersibuk. Pakai angka dari data.',
  '- insights: 2 sampai 4 poin pendek tentang apa artinya data ini bagi bisnis (misalnya: banyak yang tanya harga tapi belum tahu paket yang cocok).',
  `- actions: 2 sampai 4 tindakan yang konkret untuk minggu ini. pic harus salah satu dari: ${PICS.join(', ')}. why: satu kalimat alasan dari data.`,
  'ATURAN: pakai HANYA data yang diberikan. Jangan mengarang angka, nama client, atau kejadian. Kalau data kurang dari 10 chat, katakan itu di kalimat pertama executive dan jangan menarik kesimpulan besar. Tanpa Markdown.',
].join('\n');

/** Reads the model's JSON. Returns null when it cannot be trusted (the caller then uses fallbackSummary). Texts are cut to a sane length. */
export function parseSummary(raw: string): BodSummary | null {
  const s = String(raw || '');
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let j: any;
  try { j = JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  const executive = clean(typeof j?.executive === 'string' ? j.executive : '').slice(0, 1200);
  if (executive.length < 20) return null;
  const insights = (Array.isArray(j?.insights) ? j.insights : []).map((x: unknown) => clean(typeof x === 'string' ? x : '').slice(0, 260)).filter(Boolean).slice(0, 4);
  const actions = (Array.isArray(j?.actions) ? j.actions : []).map((x: any) => ({
    action: clean(typeof x?.action === 'string' ? x.action : '').slice(0, 220),
    pic: (PICS as readonly string[]).includes(String(x?.pic)) ? String(x.pic) : 'Sales',
    why: clean(typeof x?.why === 'string' ? x.why : '').slice(0, 220),
  })).filter((x: InsightAction) => x.action).slice(0, 4);
  return { executive, insights, actions };
}

const num = (n: number) => n.toLocaleString('id-ID');
/** The summary written from the numbers alone, when the AI is not available: the report is never left without it. */
export function fallbackSummary(i: Insights, needs: NeedCount[], days: number, daily: DayCount[] = []): BodSummary {
  if (!i.messages) return { executive: `Belum ada chat dari calon client dalam ${days} hari terakhir, jadi belum ada yang bisa dianalisa.`, insights: [], actions: [] };
  const topPk = i.packages[0]; const topCn = i.concerns[0];
  const busy = [...daily].sort((a, b) => b.messages - a.messages)[0];
  const small = i.chats < 10 ? `Datanya masih sedikit (${num(i.chats)} chat), jadi baca angka ini sebagai gambaran awal. ` : '';
  const executive = `${small}Selama ${days} hari terakhir ada ${num(i.chats)} calon client yang menulis dengan ${num(i.messages)} pesan.`
    + (topPk ? ` Paket yang paling banyak ditanya adalah ${topPk.label} (${num(topPk.chats)} chat).` : ' Belum ada paket yang disebut secara jelas.')
    + (topCn ? ` Kekhawatiran terbesar adalah ${topCn.label.toLowerCase()} (${num(topCn.chats)} chat).` : '')
    + (needs[0] ? ` Kebutuhan yang paling sering disebut ke bot: ${needs[0].need} (${num(needs[0].chats)} chat).` : '')
    + (busy && busy.messages > 0 ? ` Hari tersibuk ${busy.day} dengan ${num(busy.chats)} chat.` : '');
  const actions: InsightAction[] = [];
  if (topCn?.key === 'harga') actions.push({ action: 'Siapkan jawaban harga dan perbandingan paket yang jelas untuk dikirim di balasan pertama.', pic: 'Sales', why: `Harga dan biaya ditanyakan di ${num(topCn.chats)} chat.` });
  if (topCn?.key === 'hasil' || i.concerns.some((c) => c.key === 'percaya')) actions.push({ action: 'Kumpulkan contoh hasil client dan testimoni untuk dikirim bersama deck.', pic: 'Tim Konten', why: 'Client ingin bukti hasil sebelum memutuskan.' });
  if (topPk) actions.push({ action: `Pastikan skrip bot menjelaskan ${topPk.label} dengan lengkap dan ajak konsultasi gratis.`, pic: 'Sales', why: `${topPk.label} paling banyak ditanya.` });
  return { executive, insights: [], actions: actions.slice(0, 4) };
}
