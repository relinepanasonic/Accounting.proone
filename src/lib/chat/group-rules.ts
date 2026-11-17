/**
 * Fefe in marketplace WhatsApp groups: the smartest and funniest person in the group, not a salesperson. Rules as pure functions (tested).
 * Fefe only talks in groups the team switched on, in SHORT casual bubbles (like someone yapping), answers real marketplace questions, cheers people who show
 * their store or their work ("wah kereeeen kak"), and never promotes: no price, no package, no link, no number. When someone needs more depth she may say
 * "kl mau tanya tanya lebih detail boleh japri saya ya guys": whoever wants that writes to us first. Nobody in a group is stored or contacted.
 */

export const GROUP_MAX_PER_DAY = 5;          // times Fefe talks per group per day
export const GROUP_GAP_MIN = 20;             // minutes between two of them in one group
export const PERSON_GAP_HOURS = 6;           // hours before the same person gets an answer again
export const GROUP_MIN_CHARS = 15;
export const GROUP_MAX_CHARS = 600;
export const MAX_BUBBLES = 3;
export const BUBBLE_MAX = 170;

const QUESTION = /\b(gimana|bagaimana|kenapa|mengapa|apa|apakah|bisa|boleh|tips|cara|berapa|ada yang tau|ada yang tahu|tolong|mohon|kok|solusi|saran|minta|bingung|help|how|why|sebaiknya|enaknya|mending)\b|\?/i;
const MARKETPLACE = /\b(shopee|tokopedia|tokped|tiktok|tts|lazada|blibli|bukalapak|marketplace|toko|produk|iklan|ads|roas|gmv|klik|konversi|omzet|penjualan|ongkir|voucher|promo|algoritma|ranking|pesanan|order|resi|retur|pembeli|buyer|seller|penjual|flash sale|live|affiliate|komisi|stok|katalog|etalase|sku|rating|ulasan|penalti|poin|suspend|saldo|pencairan|biaya admin|cod|judul|foto|kata kunci|keyword|sepi|boncos|margin|hpp|laba|rugi|bep|dropship|reseller)\b/i;
/** Someone showing an achievement or their store: "alhamdulillah omzet tembus 50jt", "baru launching toko", "ini hasil foto produk saya". */
const FLEX = /\b(alhamdulillah|akhirnya|tembus|naik|meledak|laris|ramai|sold ?out|habis terjual|closing|launching|baru buka|baru jadi|hasil (foto|desain|edit|iklan|video|toko)|pencapaian|rating (5|lima)|bintang (5|lima)|ini toko (saya|ku|aku)|toko (saya|ku|aku)|karya saya|portofolio|proud|bangga)\b/i;
/** Someone advertising in the group, not asking: "WTS", "open reseller", "jasa ...", links, phone numbers. */
const ADVERT = /(wts|open (reseller|dropship|po)|ready stock|jasa (edit|desain|iklan|followers|boost)|dm (aja|saya|ya)|hubungi (kami|saya)|wa\.me|chat\.whatsapp|bit\.ly|https?:\/\/|\b(\+?62|0)8\d{8,11}\b|join (grup|group|channel))/i;

export type GroupKind = 'question' | 'flex';

/** What this group message is: a real marketplace question, someone showing their work or store, or nothing Fefe should react to. */
export function classifyGroupMessage(text: string | null | undefined): GroupKind | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < GROUP_MIN_CHARS || t.length > GROUP_MAX_CHARS) return null;
  if (ADVERT.test(t)) return null;
  if (QUESTION.test(t) && MARKETPLACE.test(t)) return 'question';
  if (FLEX.test(t) && MARKETPLACE.test(t)) return 'flex';
  return null;
}

/** A real marketplace question (kept for the callers that only care about questions). */
export const worthAnswering = (text: string | null | undefined) => classifyGroupMessage(text) === 'question';

export interface GroupHistory { lastAnswerAt: string | null; answersToday: number; personLastAt: string | null }

/** May Fefe talk now: not too many today, not too soon after the last time in the group, not the same person again too soon. */
export function mayAnswerNow(h: GroupHistory, now: Date): { ok: true } | { ok: false; why: string } {
  if (h.answersToday >= GROUP_MAX_PER_DAY) return { ok: false, why: 'daily limit of the group' };
  if (h.lastAnswerAt && now.getTime() - new Date(h.lastAnswerAt).getTime() < GROUP_GAP_MIN * 60000) return { ok: false, why: 'too soon after the last answer' };
  if (h.personLastAt && now.getTime() - new Date(h.personLastAt).getTime() < PERSON_GAP_HOURS * 3600000) return { ok: false, why: 'this person was answered recently' };
  return { ok: true };
}

export interface GroupAnswer { talk: boolean; bubbles: string[]; dm: boolean }

/** The model's JSON: { bicara, pesan: [..], japri }. Null when there is none. */
export function parseGroupAnswer(text: string): GroupAnswer | null {
  const m = /\{[\s\S]*\}/.exec(String(text ?? ''));
  if (!m) return null;
  let j: any;
  try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const raw = Array.isArray(j.pesan) ? j.pesan : typeof j.pesan === 'string' ? [j.pesan] : [];
  return { talk: j.bicara === true, bubbles: raw.map((x: unknown) => String(x ?? '')), dm: j.japri === true };
}

/** The line that asks, once, to continue in private. Whoever answers it wrote to us first. */
export const DM_LINES = ['kl mau tanya tanya lebih detail boleh japri saya ya guys', 'kalo mau bahas lebih detail boleh japri aja ya guys'];

const cutAtSentence = (t: string, max: number) => {
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return (end > 40 ? cut.slice(0, end) : cut).replace(/[,\s]+$/, '').trim();
};

/**
 * The bubbles as they may be sent: at most MAX_BUBBLES short ones, no link, no phone number, no markdown, no selling words. When the model wants to invite
 * the person to private chat, the fixed "japri" line is added as the last bubble (the model never writes it, so the wording stays ours).
 */
const SELLING = /\b(paket|harga|rp ?\d|diskon|promo|konsultasi gratis|gratis konsultasi|jasa kami|layanan kami|order sekarang|hubungi kami|kontak kami|prof toko online)\b/i;
export function cleanBubbles(bubbles: string[], opts: { dm: boolean; pick?: number }): string[] {
  const out: string[] = [];
  for (const b of bubbles) {
    let t = String(b ?? '').replace(/\r\n/g, '\n').replace(/\*+/g, '').replace(/^#+\s*/gm, '').replace(/https?:\/\/\S+/gi, '').replace(/\b(\+?62|0)8[\d\s-]{8,13}\d\b/g, '').replace(/\s+/g, ' ').trim();
    if (t.length < 3 || SELLING.test(t)) continue;
    out.push(cutAtSentence(t, BUBBLE_MAX));
    if (out.length >= MAX_BUBBLES) break;
  }
  if (!out.length) return [];
  if (opts.dm) out.push(DM_LINES[(opts.pick ?? 0) % DM_LINES.length]);
  return out;
}

export const GROUP_SYSTEM = (knowledge: string, persona = 'Fefe') => [
  `Kamu ${persona}, anak marketplace yang paling jago dan paling asyik di grup WhatsApp para seller (Shopee, TikTok Shop, Tokopedia). Kamu bukan sales, kamu temen nongkrong yang pinter: ngasih jawaban yang berguna sambil bercanda, ga sok pinter, ga menggurui.`,
  '',
  'GAYA (penting)',
  '- Ngobrol santai ala WhatsApp: "guys", "kak", "wkwk", "sih", "nih", "dong", "banget". Boleh satu emoji sesekali, jangan banyak.',
  '- PENDEK. Kirim 1 sampai 3 pesan, tiap pesan cuma 1 kalimat pendek (maksimal sekitar 150 huruf). Jangan satu paragraf panjang. Seperti orang yang nyerocos pelan-pelan, satu ide per pesan.',
  '- Kalau ada yang pamer toko, hasil kerja atau pencapaian (omzet naik, toko baru, foto bagus), puji dengan tulus dan heboh, misalnya "wah kereeeen kak" lalu satu komentar spesifik atau pertanyaan singkat. Jenisnya "puji".',
  '- Kalau ada pertanyaan seller, jawab yang berguna dengan bahasa gampang. Jenisnya "jawab".',
  '',
  'ATURAN KERAS',
  '- DILARANG promosi dalam bentuk apa pun: jangan sebut paket, harga, diskon, jasa, nama perusahaan, link atau nomor telepon. Kamu cuma anggota grup yang pinter.',
  '- Jawab hanya kalau yakin jawabannya benar dari PENGETAHUAN atau ilmu dasar e-commerce yang pasti. Kalau tidak yakin, atau soal kebijakan, biaya, angka atau fitur yang sering berubah, isi "bicara": false (jangan menebak).',
  '- Jangan menjanjikan hasil. Jangan menyalahkan orang. Jangan menjawab hal yang bukan soal jualan online.',
  '- Isi "japri": true HANYA kalau orangnya jelas butuh bahasan lebih dalam soal tokonya sendiri (misalnya "toko saya sepi, tolong dicek", "iklan saya boncos terus"), dan paling banyak di sekitar 1 dari 3 kali kamu bicara. JANGAN menulis ajakan japri sendiri di "pesan", sistem yang menambahkannya.',
  '',
  'PENGETAHUAN',
  knowledge.trim() || '(kosong: jawab hanya yang pasti)',
  '',
  'Balas HANYA dengan satu objek JSON: {"bicara":true,"jenis":"jawab","pesan":["pesan pendek 1","pesan pendek 2"],"japri":false}',
].join('\n');
