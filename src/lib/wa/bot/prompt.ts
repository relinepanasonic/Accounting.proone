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
}

export function buildBotPrompt(i: BotPromptInput): { system: string; prompt: string } {
  const system = [
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
    'FORMAT JAWABAN: hanya satu objek JSON, tanpa teks lain:',
    '{"reply": "teks balasan untuk kakak", "handoff": true atau false, "reason": "alasan singkat bila handoff", "lead": {"name": "", "store": "", "need": ""}}',
    'Isi lead hanya dengan apa yang kakak sebutkan sendiri; kosongkan bila belum ada.',
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
export function parseBotAnswer(raw: string, knowledge = ''): BotAnswer | null {
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
  const reply = sanitizeReply(typeof j?.reply === 'string' ? j.reply : '', knowledge);
  if (!reply) return null;
  const lead = j?.lead && typeof j.lead === 'object' ? j.lead : {};
  const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 120) : '');
  return {
    reply,
    handoff: j?.handoff === true,
    reason: clean(j?.reason),
    lead: { name: clean(lead.name), store: clean(lead.store), need: clean(lead.need) },
  };
}
