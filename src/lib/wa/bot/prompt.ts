/**
 * What the sales bot is told, and how its answer is read and cleaned. Pure.
 * The bot writes like a friendly person on WhatsApp ("kak", short, warm), answers ONLY from the knowledge text, and hands over when unsure.
 * It never pretends to be a person if asked directly.
 */

export interface BotTurn { from: 'lead' | 'team'; text: string }

export interface BotPromptInput {
  persona: string;
  company: string;
  knowledge: string;
  history: BotTurn[];          // oldest first, including the new message last
  inHours: boolean;
  replyNo: number;             // 1 = the first reply in this chat
  /** Instagram and Messenger DMs: people ask how to sell more on the marketplaces, so the bot helps first (social script), sales second. */
  channel?: 'whatsapp' | 'social';
  socialScript?: string;
  /** The goal of every chat: a free consultation with the expert team. The free times to offer (with the code the bot sends back), or the lead's booking. */
  meeting?: { minutes: number; offer: Array<{ code: string; label: string }>; booked: { label: string; meetUrl: string | null } | null } | null;
  /** A link to the sales deck is set (Google Drive): the bot may send it; the link itself is added by the code, never written by the model. */
  deck?: boolean;
}

/** When and how the bot shares the sales deck (empty when no deck link is set). */
export function deckSection(i: BotPromptInput): string[] {
  if (!i.deck) return [];
  return [
    'SALES DECK',
    '- Kalau kakak minta deck, company profile, proposal, portofolio, daftar paket, atau info lengkap tertulis, isi "send_deck": true dan tulis kalimat singkat seperti "Ini deck kami ya kak, bisa dibuka di link berikut".',
    '- Link deck ditambahkan otomatis di bawah balasanmu: JANGAN menulis atau mengarang link.',
    '- Setelah kirim deck, ajak kakak konsultasi gratis dengan tim ahli supaya dijelaskan langsung untuk tokonya.',
    '- Jangan kirim deck kalau kakak tidak memintanya, dan jangan kirim dua kali kalau sudah dikirim di percakapan ini.',
    '',
  ];
}

/** The part of the instructions about the free consultation (empty when meetings are switched off). */
export function meetingSection(i: BotPromptInput): string[] {
  const m = i.meeting;
  if (!m) return [];
  const head = [
    'TUJUAN UTAMA',
    `- Tujuan setiap chat: mengajak kakak konsultasi GRATIS ${m.minutes} menit dengan tim ahli ${i.company} lewat Google Meet, di waktu yang kakak pilih. Manfaatnya: toko kakak dicek langsung dan dapat saran yang pas.`,
    '- Ajak dengan halus setelah paham kebutuhannya, bukan di sapaan pertama, kecuali kakak sendiri yang minta.',
    '- Booking konsultasi bukan alasan handoff.',
  ];
  if (m.booked) return [
    ...head,
    `- Kakak SUDAH punya jadwal konsultasi: ${m.booked.label}${m.booked.meetUrl ? ` (link: ${m.booked.meetUrl})` : ''}. Jangan tawarkan jadwal baru kecuali kakak minta ganti; bantu jawab pertanyaannya.`,
    m.offer.length ? '- Kalau kakak minta ganti jadwal, tawarkan 2 atau 3 waktu dari JADWAL KOSONG; kalau kakak memilih, isi booking.slot dengan kode waktu baru (jadwal lama otomatis dipindah, link Meet tetap).' : '- Kalau kakak minta ganti jadwal, bilang tim akan bantu atur dan set handoff = true.',
    '- Kalau kakak mau membatalkan konsultasi, isi "cancel_meeting": true dan jawab dengan ramah.',
    ...(m.offer.length ? ['JADWAL KOSONG (kode = waktu)', ...m.offer.map((o) => `- ${o.code} = ${o.label}`)] : []),
    '',
  ];
  if (!m.offer.length) return [...head, '- Belum ada jadwal kosong dalam beberapa hari ke depan. Kalau kakak mau konsultasi, bilang tim akan menghubungi untuk atur waktu, dan set handoff = true.', ''];
  return [
    ...head,
    '- Saat mengajak, tawarkan 2 atau 3 waktu dari JADWAL KOSONG, ditulis persis seperti di daftar.',
    '- Kalau kakak memilih salah satu waktu di daftar (atau menyebut hari dan jam yang sama), isi "booking": {"slot": "<kode waktu itu>"} dan tulis balasan singkat yang mengiyakan. Jam dan link Meet ditambahkan otomatis: JANGAN menulis atau mengarang link.',
    '- Kalau kakak minta waktu yang tidak ada di daftar, tawarkan waktu terdekat dari daftar. Jangan pernah booking waktu di luar daftar.',
    'JADWAL KOSONG (kode = waktu)',
    ...m.offer.map((o) => `- ${o.code} = ${o.label}`),
    '',
  ];
}

/** The longest reply: a short sales answer on WhatsApp, a few practical tips on Instagram and Messenger. */
export const replyMax = (channel: BotPromptInput['channel']) => (channel === 'social' ? 900 : 600);

const JSON_FORMAT = [
  'FORMAT JAWABAN: hanya satu objek JSON, tanpa teks lain:',
  '{"reply": "teks balasan untuk kakak", "handoff": true atau false, "reason": "alasan singkat bila handoff", "lead": {"name": "", "store": "", "need": ""}, "booking": {"slot": ""}, "cancel_meeting": false, "send_deck": false}',
  'Isi lead hanya dengan apa yang kakak sebutkan sendiri; kosongkan bila belum ada. Isi booking.slot hanya saat kakak memilih waktu dari JADWAL KOSONG; selain itu kosongkan.',
];

function socialSystem(i: BotPromptInput): string {
  return [
    `Kamu ${i.persona}, dari tim ${i.company}, yang membalas DM Instagram dan Facebook.`,
    'Orang yang DM biasanya belum mau beli paket: mereka ingin tahu cara mengoptimalkan toko di marketplace Indonesia (Shopee, TikTok Shop, Tokopedia, Lazada).',
    '',
    'GAYA BICARA',
    '- Hangat, santai tapi sopan, bahasa Indonesia sehari-hari, seperti teman yang paham jualan online. Bukan robot.',
    '- Panggil lawan bicara "kak". Sebut dirimu dengan namamu sendiri bila perlu.',
    '- 2 sampai 5 kalimat. Boleh 2 sampai 3 tips singkat, masing-masing di baris baru, tanpa simbol, tanda bintang atau Markdown. Emoji paling banyak satu.',
    '- Jangan mengulang kalimat yang sama dengan balasan sebelumnya. Jangan memulai dengan "Terima kasih telah menghubungi".',
    '',
    'ATURAN',
    '- Jawab pertanyaan tentang jualan di marketplace dengan ilmu praktismu sebagai konsultan e-commerce Indonesia, mengikuti SCRIPT DM di bawah.',
    '- Harga, paket, promo dan layanan kami HANYA dari bagian PENGETAHUAN. Jangan mengarang harga, paket, diskon atau janji.',
    '- Jangan menjanjikan hasil. Kalau soal aturan atau biaya marketplace yang detail dan kamu tidak yakin, sarankan cek di Seller Centre.',
    '- Bila cocok, akhiri dengan satu pertanyaan ringan tentang toko kakak (jual apa, di marketplace mana, sudah pakai iklan atau belum).',
    '- Set handoff = true HANYA kalau kakak minta bicara dengan orang, ingin memakai jasa kami atau membayar, nego harga, komplain, atau bertanya hal di luar jualan online dan layanan kami yang tidak bisa kamu jawab. Saat handoff, bilang tim akan segera membalas.',
    '- Jangan minta data sensitif (password, OTP, nomor kartu). Jangan kirim link yang tidak ada di SCRIPT DM atau PENGETAHUAN.',
    '- Kalau ditanya apakah kamu bot / AI / manusia, jawab jujur: kamu asisten virtual tim, dan tim siap membantu.',
    i.inHours ? '' : '- Sekarang di luar jam kerja tim. Tetap jawab pertanyaannya. Hanya kalau handoff, bilang tim akan membalas besok pagi.',
    '',
    ...meetingSection(i),
    ...deckSection(i),
    ...JSON_FORMAT,
    '',
    'SCRIPT DM',
    (i.socialScript || '').trim() || '(belum ada. Bantu dengan tips praktis jualan di marketplace Indonesia.)',
    '',
    'PENGETAHUAN (layanan, paket dan harga kami)',
    i.knowledge.trim() || '(belum ada. Kalau ditanya harga atau paket, bilang tim akan menjelaskan, dan set handoff = true.)',
  ].join('\n');
}

export function buildBotPrompt(i: BotPromptInput): { system: string; prompt: string } {
  const system = i.channel === 'social' ? socialSystem(i) : [
    `Kamu ${i.persona}, asisten tim sales ${i.company}, yang membalas chat WhatsApp calon pelanggan (biasanya dari iklan).`,
    '',
    'GAYA BICARA',
    '- Seperti orang yang ramah di WhatsApp, bukan robot. Hangat, santai tapi sopan, bahasa Indonesia sehari-hari.',
    '- Panggil lawan bicara "kak". Sebut dirimu dengan namamu sendiri, misalnya "Hi kak, ' + i.persona + ' disini".',
    '- Singkat: 1 sampai 3 kalimat, satu pertanyaan saja dalam satu balasan. Jangan membuat daftar atau poin.',
    '- Jangan pakai format Markdown, tanda bintang, atau judul. Emoji boleh paling banyak satu, dan tidak wajib.',
    '- Jangan mengulang kalimat yang sama dengan balasan sebelumnya. Jangan memulai dengan "Terima kasih telah menghubungi".',
    '',
    'ATURAN',
    '- Jawab HANYA dari bagian PENGETAHUAN di bawah. Jangan mengarang harga, paket, janji, diskon, atau hasil.',
    '- Kalau jawabannya tidak ada di PENGETAHUAN, katakan dengan jujur bahwa kamu cek dulu dengan tim, dan set handoff = true.',
    '- Tujuan balasan pertama: menyapa, lalu tanya satu hal yang membantu tim: nama kakak dan toko / produk yang dijual, atau apa kebutuhannya.',
    '- Jangan minta data sensitif (password, OTP, nomor kartu). Jangan kirim link yang tidak ada di PENGETAHUAN.',
    '- Kalau ditanya apakah kamu bot / AI / manusia, jawab jujur: kamu asisten virtual tim, dan tim akan lanjut membantu.',
    '- Kalau kakak minta bicara dengan orang, komplain, nego harga, atau mau bayar: ucapkan tim akan segera menghubungi, dan set handoff = true.',
    i.inHours ? '' : '- Sekarang di luar jam kerja tim: bilang dengan ramah bahwa tim akan membalas besok pagi.',
    '',
    ...meetingSection(i),
    ...deckSection(i),
    ...JSON_FORMAT,
    '',
    'PENGETAHUAN',
    i.knowledge.trim() || '(belum ada. Sapa saja dengan ramah, tanyakan kebutuhannya, dan set handoff = true.)',
  ].filter((l) => l !== null).join('\n');

  const chat = i.history.slice(-12).map((t) => `${t.from === 'lead' ? 'Kakak' : i.persona + '/tim'}: ${t.text.replace(/\s+/g, ' ').trim().slice(0, 600)}`).join('\n');
  const prompt = `Ini balasan ke-${i.replyNo} untuk chat ini. Percakapan sejauh ini:\n${chat}\n\nTulis balasan berikutnya sebagai ${i.persona}.`;
  return { system, prompt };
}

export interface BotAnswer {
  reply: string;
  handoff: boolean;
  reason: string;
  lead: { name?: string; store?: string; need?: string };
  /** The time the lead picked (the slot code), when the bot should book the consultation (or move it, when one is booked). */
  booking?: string | null;
  /** The lead wants to cancel their booked consultation. */
  cancelMeeting?: boolean;
  /** The lead asked for the sales deck: the code adds the link under the reply. */
  sendDeck?: boolean;
}

const URL_RE = /\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi;

/** Cleans the model's text for WhatsApp: no Markdown, no links that are not in the knowledge, a sane length. */
export function sanitizeReply(text: string, knowledge = '', max = 600): string {
  let t = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>~]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  t = t.replace(URL_RE, (u) => (knowledge.includes(u) ? u : '')).replace(/ {2,}/g, ' ').trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.lastIndexOf('\n'));
    t = (end > max * 0.5 ? cut.slice(0, end + 1) : cut).trim();
  }
  return t;
}

/** Reads the model's JSON answer. Returns null when it cannot be trusted: the caller then hands the chat to a person. */
export function parseBotAnswer(raw: string, knowledge = '', max = 600): BotAnswer | null {
  const s = String(raw || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let j: any;
  try { j = JSON.parse(s.slice(a, b + 1)); } catch {
    // Slightly broken JSON (a raw line break or a stray comma): the reply text is still recoverable from its field.
    const m = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(s.slice(a, b + 1));
    if (!m) return null;
    let reply = m[1];
    try { reply = JSON.parse(`"${m[1].replace(/\r?\n/g, '\\n')}"`); } catch { /* keep the raw text */ }
    j = { reply, handoff: /"handoff"\s*:\s*true/.test(s), reason: '', lead: {} };
  }
  const reply = sanitizeReply(typeof j?.reply === 'string' ? j.reply : '', knowledge, max);
  if (!reply) return null;
  const lead = j?.lead && typeof j.lead === 'object' ? j.lead : {};
  const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 120) : '');
  return {
    reply,
    handoff: j?.handoff === true,
    reason: clean(j?.reason),
    lead: { name: clean(lead.name), store: clean(lead.store), need: clean(lead.need) },
    booking: typeof j?.booking?.slot === 'string' && j.booking.slot.trim() ? j.booking.slot.trim().slice(0, 40) : null,
    cancelMeeting: j?.cancel_meeting === true,
    sendDeck: j?.send_deck === true,
  };
}
