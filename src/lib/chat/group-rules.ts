/**
 * Fefe in marketplace WhatsApp groups. Rules as pure functions (tested). Fefe only answers in groups the team has switched on, only a real marketplace question,
 * slowly (a few answers a day, with a long pause), never advertises in the group, and never writes a phone number or a link other than the Kampus.
 * Nobody in a group is stored or contacted: the group's messages are not saved, and a member is only ever remembered as a one-way hash for the pause rule.
 */

export const GROUP_MAX_PER_DAY = 5;          // answers per group per day
export const GROUP_GAP_MIN = 20;             // minutes between two answers in one group
export const PERSON_GAP_HOURS = 6;           // hours before the same person is answered again
export const GROUP_MIN_CHARS = 15;
export const GROUP_MAX_CHARS = 600;

const QUESTION = /\b(gimana|bagaimana|kenapa|mengapa|apa|apakah|bisa|boleh|tips|cara|berapa|ada yang tau|ada yang tahu|tolong|mohon|kok|solusi|saran|minta|bingung|help|how|why|sebaiknya|enaknya|mending)\b|\?/i;
const MARKETPLACE = /\b(shopee|tokopedia|tokped|tiktok|tts|lazada|blibli|bukalapak|marketplace|toko|produk|iklan|ads|roas|gmv|klik|konversi|omzet|penjualan|ongkir|voucher|promo|algoritma|ranking|pesanan|order|resi|retur|pembeli|buyer|seller|penjual|flash sale|live|affiliate|komisi|stok|katalog|etalase|sku|rating|ulasan|penalti|poin|suspend|saldo|pencairan|biaya admin|cod|judul|foto|kata kunci|keyword|sepi|boncos|margin|hpp|laba|rugi|bep|dropship|reseller)\b/i;
/** Someone advertising in the group, not asking: "WTS", "open reseller", "jasa ...", links, phone numbers. */
const ADVERT = /(wts|open (reseller|dropship|po)|ready stock|jasa (edit|desain|iklan|followers|boost)|dm (aja|saya|ya)|hubungi (kami|saya)|wa\.me|chat\.whatsapp|bit\.ly|https?:\/\/|\b(\+?62|0)8\d{8,11}\b|join (grup|group|channel))/i;

/** Is this message a real question about selling on a marketplace that Fefe may answer? */
export function worthAnswering(text: string | null | undefined): boolean {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < GROUP_MIN_CHARS || t.length > GROUP_MAX_CHARS) return false;
  if (ADVERT.test(t)) return false;
  return QUESTION.test(t) && MARKETPLACE.test(t);
}

export interface GroupHistory { lastAnswerAt: string | null; answersToday: number; personLastAt: string | null }

/** May Fefe answer now: not too many today, not too soon after the last answer in the group, not the same person again too soon. */
export function mayAnswerNow(h: GroupHistory, now: Date): { ok: true } | { ok: false; why: string } {
  if (h.answersToday >= GROUP_MAX_PER_DAY) return { ok: false, why: 'daily limit of the group' };
  if (h.lastAnswerAt && now.getTime() - new Date(h.lastAnswerAt).getTime() < GROUP_GAP_MIN * 60000) return { ok: false, why: 'too soon after the last answer' };
  if (h.personLastAt && now.getTime() - new Date(h.personLastAt).getTime() < PERSON_GAP_HOURS * 3600000) return { ok: false, why: 'this person was answered recently' };
  return { ok: true };
}

export interface GroupAnswer { answer: boolean; reply: string; invite: boolean }

/** The model's JSON: { jawab, balasan, ajak }. Null when there is none. */
export function parseGroupAnswer(text: string): GroupAnswer | null {
  const m = /\{[\s\S]*\}/.exec(String(text ?? ''));
  if (!m) return null;
  let j: any;
  try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  return { answer: j.jawab === true, reply: String(j.balasan ?? '').trim(), invite: j.ajak === true };
}

const KAMPUS = /^https:\/\/profesoronline\.id\/kampus\/?[^\s]*$/i;

/**
 * The reply as it may be sent: no phone number, no link but the Kampus, no markdown, at most GROUP_MAX_REPLY characters, cut at a sentence. Empty = do not send.
 * When the model asked to invite the person to chat privately, one polite line with the sales number is added (opt-in: they must write first).
 */
export const GROUP_MAX_REPLY = 700;
export function cleanGroupReply(reply: string, opts: { invite: boolean; salesPhone: string }): string {
  let t = String(reply ?? '').replace(/\r\n/g, '\n').replace(/\*+/g, '').replace(/^#+\s*/gm, '').trim();
  t = t.replace(/https?:\/\/\S+/gi, (u) => (KAMPUS.test(u.replace(/[.,)]+$/, '')) ? u : '')).replace(/\b(\+?62|0)8[\d\s-]{8,13}\d\b/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > GROUP_MAX_REPLY) {
    const cut = t.slice(0, GROUP_MAX_REPLY);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    t = (end > 200 ? cut.slice(0, end + 1) : cut).trim();
  }
  if (t.length < 20) return '';
  if (opts.invite && /^\d{8,15}$/.test(opts.salesPhone)) t += `\n\nKalau mau dibantu cek langsung tokonya, boleh chat Fefe pribadi ya kak: wa.me/${opts.salesPhone}. Konsultasinya gratis.`;
  return t;
}

export const GROUP_SYSTEM = (knowledge: string, persona = 'Fefe') => [
  `Kamu ${persona}, konsultan marketplace dari Prof Toko Online, yang ikut di grup WhatsApp para seller (Shopee, TikTok Shop, Tokopedia). Kamu menjawab pertanyaan seller dengan ilmu praktis, seperti anggota grup yang membantu.`,
  '',
  'ATURAN',
  '- Jawab HANYA kalau pesan itu pertanyaan nyata tentang jualan di marketplace dan kamu yakin jawabannya benar dari PENGETAHUAN di bawah atau ilmu dasar e-commerce yang pasti. Kalau tidak yakin, atau soal kebijakan, biaya, angka atau fitur yang sering berubah, isi "jawab": false (jangan menebak).',
  '- Bukan tempat jualan. Jangan promosi, jangan sebut harga atau paket, jangan menawarkan jasa. Cukup jawab dengan berguna.',
  '- Singkat: 2 sampai 5 kalimat, bahasa Indonesia santai dan sopan, panggil "kak". Tanpa tanda bintang, tanpa judul, tanpa daftar panjang.',
  '- Jangan menulis nomor telepon dan jangan menaruh link kecuali https://profesoronline.id/kampus/ (boleh disebut satu kali kalau relevan).',
  '- Jangan menjanjikan hasil atau angka penjualan. Jangan menyalahkan orang. Jangan menjawab pertanyaan yang bukan tentang jualan online.',
  '- Isi "ajak": true HANYA kalau orangnya jelas butuh dibantu lebih dalam untuk tokonya sendiri (misalnya "toko saya sepi, tolong dicek", "iklan saya boncos terus"). Selain itu false.',
  '',
  'PENGETAHUAN',
  knowledge.trim() || '(kosong: jawab hanya yang pasti)',
  '',
  'Balas HANYA dengan satu objek JSON: {"jawab":true,"balasan":"...","ajak":false}',
].join('\n');
