import { describe, it, expect } from 'vitest';
import { decideBot, isBotEcho, inOpenHours, needsHuman, type BotInput } from './decide';
import { buildBotPrompt, parseBotAnswer, replyMax, sanitizeReply } from './prompt';
import { DEFAULT_SOCIAL_SCRIPT } from './social-script';

const base: BotInput = { enabled: true, deviceRole: 'sales', isGroup: false, isFromMe: false, body: 'Halo kak, info iklan shopee', mediaType: null, state: { status: null, replies: 0 }, maxReplies: 4, echoOfBot: false };

describe('decideBot', () => {
  it('answers a new lead on a sales number', () => {
    expect(decideBot(base)).toEqual({ action: 'reply' });
  });
  it('never answers on a non-sales number, with the switch off, or in a group', () => {
    expect(decideBot({ ...base, deviceRole: 'admin' })).toMatchObject({ action: 'skip' });
    expect(decideBot({ ...base, enabled: false })).toMatchObject({ action: 'skip', reason: 'bot-off' });
    expect(decideBot({ ...base, isGroup: true })).toMatchObject({ action: 'skip', reason: 'group' });
  });
  it('stays silent once a person has the chat, or the chat is switched off', () => {
    expect(decideBot({ ...base, state: { status: 'human', replies: 1 } })).toMatchObject({ action: 'skip' });
    expect(decideBot({ ...base, state: { status: 'off', replies: 0 } })).toMatchObject({ action: 'skip' });
  });
  it('a message from our own number that is not the bot means a salesperson took over', () => {
    expect(decideBot({ ...base, isFromMe: true, body: 'Halo kak, saya Rani' })).toMatchObject({ action: 'takeover' });
    expect(decideBot({ ...base, isFromMe: true, echoOfBot: true })).toMatchObject({ action: 'skip', reason: 'own-bot-message' });
    expect(decideBot({ ...base, isFromMe: true, state: { status: 'human', replies: 1 } })).toMatchObject({ action: 'skip' });
  });
  it('stops after the maximum number of bot messages and hands over', () => {
    expect(decideBot({ ...base, state: { status: 'bot', replies: 4 } })).toMatchObject({ action: 'limit' });
    expect(decideBot({ ...base, state: { status: 'bot', replies: 3 } })).toEqual({ action: 'reply' });
  });
  it('ignores an empty message with no media', () => {
    expect(decideBot({ ...base, body: '  ' })).toMatchObject({ action: 'skip', reason: 'empty' });
    expect(decideBot({ ...base, body: null, mediaType: 'image' })).toEqual({ action: 'reply' });
  });
});

describe('isBotEcho', () => {
  it('recognises the bot\'s own message coming back, ignoring spaces and case', () => {
    expect(isBotEcho('Hi kak,  Fefe disini.\nApa kabar?', ['hi kak, fefe disini. apa kabar?'])).toBe(true);
    expect(isBotEcho('Halo kak, saya Rani dari tim', ['Hi kak, Fefe disini. Apa kabar?'])).toBe(false);
    expect(isBotEcho('', ['x'])).toBe(false);
  });
});

describe('needsHuman', () => {
  it('flags complaints, negotiation, payment, calls and requests for a person', () => {
    expect(needsHuman('saya kecewa banget sama layanannya')).toMatch(/Complaint/);
    expect(needsHuman('bisa nego harganya kak?')).toMatch(/negotiation/);
    expect(needsHuman('mau transfer ke rekening mana')).toMatch(/Payment/);
    expect(needsHuman('bisa telepon saya sekarang?')).toMatch(/call/);
    expect(needsHuman('mau bicara sama orangnya langsung')).toMatch(/person/);
  });
  it('leaves normal questions to the bot', () => {
    expect(needsHuman('Halo kak, mau tanya soal iklan shopee')).toBeNull();
    expect(needsHuman('toko saya jual kawat nyamuk')).toBeNull();
    expect(needsHuman('')).toBeNull();
  });
});

describe('inOpenHours (Jakarta time)', () => {
  it('08:00 to 21:00 in Jakarta; 14:00 UTC is 21:00 there', () => {
    expect(inOpenHours(new Date('2026-11-12T03:00:00Z'), '08:00', '21:00')).toBe(true);    // 10:00
    expect(inOpenHours(new Date('2026-11-12T14:30:00Z'), '08:00', '21:00')).toBe(false);   // 21:30
    expect(inOpenHours(new Date('2026-11-12T22:00:00Z'), '08:00', '21:00')).toBe(false);   // 05:00
  });
  it('handles hours that cross midnight', () => {
    expect(inOpenHours(new Date('2026-11-12T20:00:00Z'), '20:00', '06:00')).toBe(true);    // 03:00
    expect(inOpenHours(new Date('2026-11-12T05:00:00Z'), '20:00', '06:00')).toBe(false);   // 12:00
  });
});

describe('prompt', () => {
  it('tells the model the persona, the "kak" style, the knowledge and the JSON format', () => {
    const p = buildBotPrompt({ persona: 'Fefe', company: 'Prof Toko Online', knowledge: 'Paket Hemat: ISI', history: [{ from: 'lead', text: 'halo' }], inHours: true, replyNo: 1 });
    expect(p.system).toContain('Fefe');
    expect(p.system).toContain('"kak"');
    expect(p.system).toContain('Paket Hemat: ISI');
    expect(p.system).toContain('"handoff"');
    expect(p.system).not.toContain('luar jam kerja');
    expect(p.prompt).toContain('Kakak: halo');
  });
  it('mentions the closed hours only when closed, and the bot never claims to be a person', () => {
    const p = buildBotPrompt({ persona: 'Fefe', company: 'X', knowledge: '', history: [], inHours: false, replyNo: 1 });
    expect(p.system).toContain('luar jam kerja');
    expect(p.system).toMatch(/jujur/);
  });
});

describe('parseBotAnswer / sanitizeReply', () => {
  it('reads a JSON answer, also when the model wraps it in text', () => {
    const a = parseBotAnswer('Berikut: {"reply":"Hi kak, Fefe disini. Apa ada yang bisa dibantu kak?","handoff":false,"reason":"","lead":{"name":"Budi","store":"","need":"iklan"}}');
    expect(a).toMatchObject({ reply: 'Hi kak, Fefe disini. Apa ada yang bisa dibantu kak?', handoff: false, lead: { name: 'Budi', need: 'iklan' } });
  });
  it('refuses an answer it cannot trust', () => {
    expect(parseBotAnswer('Hi kak')).toBeNull();
    expect(parseBotAnswer('{"reply": ""}')).toBeNull();
    expect(parseBotAnswer('{bad json}')).toBeNull();
  });
  it('recovers the reply from slightly broken JSON (a raw line break inside the text, a trailing comma)', () => {
    const broken = '```json\n{"reply": "Wah, mainan mobil aki ya kak.\nToko kakak sudah di Shopee?", "handoff": false, "lead": {"store": "kyrakidz"},}\n```';
    const a = parseBotAnswer(broken);
    expect(a?.reply).toBe('Wah, mainan mobil aki ya kak.\nToko kakak sudah di Shopee?');
    expect(a?.handoff).toBe(false);
    expect(parseBotAnswer('{"reply": "Fefe cek dulu ya kak", "handoff": true,}')).toMatchObject({ reply: 'Fefe cek dulu ya kak', handoff: true });
  });
  it('removes Markdown and links that are not in the knowledge, and keeps the ones that are', () => {
    expect(sanitizeReply('**Halo kak** cek https://evil.test/x ya')).toBe('Halo kak cek ya');
    expect(sanitizeReply('Lihat https://profesoronline.id/info ya', 'Info: https://profesoronline.id/info')).toContain('https://profesoronline.id/info');
  });
  it('shortens a long answer at a sentence end', () => {
    const long = 'Kalimat satu yang cukup panjang untuk uji. '.repeat(30);
    const out = sanitizeReply(long, '', 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('Instagram and Messenger script', () => {
  const base = { persona: 'Fefe', company: 'Prof Toko Online', knowledge: 'Paket Juragan Rp 3.000.000 per bulan.', history: [{ from: 'lead' as const, text: 'Kak gimana caranya biar toko Shopee ga sepi?' }], inHours: true, replyNo: 1 };
  it('DMs get the helping-first instructions and the DM script; prices still only from the knowledge', () => {
    const { system } = buildBotPrompt({ ...base, channel: 'social', socialScript: DEFAULT_SOCIAL_SCRIPT });
    expect(system).toContain('membalas DM Instagram dan Facebook');
    expect(system).toContain('SCRIPT DM');
    expect(system).toContain('Toko sepi');
    expect(system).toContain('Harga, paket, promo dan layanan kami HANYA dari bagian PENGETAHUAN');
    expect(system).toContain('Paket Juragan Rp 3.000.000');
    expect(system).not.toContain('Jawab HANYA dari bagian PENGETAHUAN');
  });
  it('WhatsApp keeps the sales instructions', () => {
    const { system } = buildBotPrompt(base);
    expect(system).toContain('Jawab HANYA dari bagian PENGETAHUAN');
    expect(system).not.toContain('SCRIPT DM');
  });
  it('outside team hours a DM is still answered', () => {
    expect(buildBotPrompt({ ...base, channel: 'social', inHours: false }).system).toContain('Tetap jawab pertanyaannya');
  });
  it('a DM answer may be longer (a few tips), a WhatsApp answer stays short', () => {
    const long = 'Tips pertama. '.repeat(55);
    expect(replyMax('social')).toBe(900);
    expect(parseBotAnswer(JSON.stringify({ reply: long, handoff: false }), '', replyMax('social'))!.reply.length).toBeGreaterThan(600);
    expect(parseBotAnswer(JSON.stringify({ reply: long, handoff: false }))!.reply.length).toBeLessThanOrEqual(600);
  });
});

describe('the free consultation', () => {
  const base = { persona: 'Fefe', company: 'Prof Toko Online', knowledge: '', history: [{ from: 'lead' as const, text: 'boleh konsultasi?' }], inHours: true, replyNo: 3 };
  const offer = [{ code: '2026-11-16T10:00+07:00', label: 'Senin 16 Nov, jam 10.00 WIB' }, { code: '2026-11-16T14:00+07:00', label: 'Senin 16 Nov, jam 14.00 WIB' }];
  it('every chat aims at a free consultation, with the real free times and their codes, on WhatsApp and in DMs', () => {
    for (const channel of ['whatsapp', 'social'] as const) {
      const { system } = buildBotPrompt({ ...base, channel, meeting: { minutes: 30, offer, booked: null } });
      expect(system).toContain('konsultasi GRATIS 30 menit');
      expect(system).toContain('- 2026-11-16T10:00+07:00 = Senin 16 Nov, jam 10.00 WIB');
      expect(system).toContain('JANGAN menulis atau mengarang link');
    }
  });
  it('a lead who already booked is not offered times again', () => {
    const { system } = buildBotPrompt({ ...base, meeting: { minutes: 30, offer: [], booked: { label: 'Senin 16 Nov, jam 10.00 WIB', meetUrl: 'https://meet.google.com/x' } } });
    expect(system).toContain('SUDAH punya jadwal');
    expect(system).not.toContain('JADWAL KOSONG (kode = waktu)');
  });
  it('meetings switched off: nothing about them', () => {
    expect(buildBotPrompt(base).system).not.toContain('TUJUAN UTAMA');
  });
  it('the time the lead picked is read from the answer', () => {
    expect(parseBotAnswer('{"reply":"Siap kak","handoff":false,"booking":{"slot":"2026-11-16T10:00+07:00"}}')?.booking).toBe('2026-11-16T10:00+07:00');
    expect(parseBotAnswer('{"reply":"Siap kak","handoff":false,"booking":{"slot":""}}')?.booking).toBeNull();
  });
});

import { effectiveMaxReplies, MEETING_MAX_REPLIES } from './decide';
import { salvageCut } from './prompt';
import { freeByDay } from '@/lib/chat/meet-rules';

describe('Fefe and the free consultation (the chats of 16 Nov)', () => {
  const ask = 'Boleh kak. \nApa bisa besok di aturkan meeting jam 15.09';

  it('a meeting request is not a reason to hand over while meetings are on; with meetings off it still is; a phone call always is', () => {
    expect(needsHuman(ask, { meetings: true })).toBeNull();
    expect(needsHuman(ask)).toMatch(/meeting/);
    expect(needsHuman('bisa zoom besok?', { meetings: true })).toBeNull();
    expect(needsHuman('bisa telepon saya sekarang?', { meetings: true })).toMatch(/call/);
    expect(needsHuman('mau ketemu langsung di kantor', { meetings: true })).toMatch(/call/);
  });

  it('the 4-message limit does not stop the bot while meetings are on', () => {
    expect(effectiveMaxReplies(4, true)).toBe(MEETING_MAX_REPLIES);
    expect(effectiveMaxReplies(4, false)).toBe(4);
    expect(effectiveMaxReplies(20, true)).toBe(20);
    const base = { enabled: true, deviceRole: 'sales', isGroup: false, isFromMe: false, body: ask, mediaType: null, state: { status: 'bot' as const, replies: 4 }, echoOfBot: false };
    expect(decideBot({ ...base, maxReplies: 4 }).action).toBe('limit');                                     // before: silence
    expect(decideBot({ ...base, maxReplies: effectiveMaxReplies(4, true) }).action).toBe('reply');        // now: the bot answers and books
  });

  it('an answer cut off in the middle still gives the lead the start of the reply', () => {
    const cutOff = '{"reply": "Siap kak Nico, untuk jam 10 besok belum tersedia kak. Tapi ada jam 09.00 dan jam 11.00 yang masih kosong, kakak mau yang mana? Kalau mau jam 11.00 saya bookingkan sekarang juga, nanti Link Google Meet langsung dikir';
    const a = parseBotAnswer(cutOff)!;
    expect(a.reply).toBe('Siap kak Nico, untuk jam 10 besok belum tersedia kak. Tapi ada jam 09.00 dan jam 11.00 yang masih kosong, kakak mau yang mana?');
    expect(a.handoff).toBe(false);
    expect(a.booking).toBeNull();
    expect(salvageCut('{"reply": "Hi', 0)).toBeNull();            // too little to send
    expect(parseBotAnswer('tidak ada json sama sekali')).toBeNull();
  });
});

describe('every free time goes to the bot', () => {
  const D = (iso: string) => new Date(iso);
  const free = [D('2026-11-17T02:00:00Z'), D('2026-11-17T03:00:00Z'), D('2026-11-17T08:00:00Z'), D('2026-11-18T02:00:00Z'), D('2026-11-19T02:00:00Z'), D('2026-11-20T02:00:00Z'), D('2026-11-21T02:00:00Z'), D('2026-11-24T02:00:00Z')];
  it('grouped by day, in WIB, at most 5 days', () => {
    const days = freeByDay(free);
    expect(days).toHaveLength(5);
    expect(days[0]).toEqual({ label: 'Selasa 17 Nov', date: '2026-11-17', times: ['09.00', '10.00', '15.00'] });
    expect(days[4].date).toBe('2026-11-21');
  });
  it('the prompt lists them and explains how to write the slot code, and asks for a short answer', () => {
    const { system } = buildBotPrompt({ persona: 'Fefe', company: 'Prof Toko Online', knowledge: 'x', history: [{ from: 'lead', text: 'besok jam 10 bisa?' }], inHours: true, replyNo: 6, meeting: { minutes: 60, offer: [{ code: '2026-11-17T09:00+07:00', label: 'Selasa 17 Nov, jam 09.00 WIB' }], days: freeByDay(free), booked: null } });
    expect(system).toContain('- Selasa 17 Nov (2026-11-17): 09.00, 10.00, 15.00');
    expect(system).toContain('contoh 2026-11-17T10:00+07:00');
    expect(system).toContain('jam terdekat yang kosong');
    expect(system).toContain('maksimal 3 kalimat');
  });
});
