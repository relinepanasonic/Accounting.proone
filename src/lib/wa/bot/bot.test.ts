import { describe, it, expect } from 'vitest';
import { decideBot, isBotEcho, inOpenHours, needsHuman, type BotInput } from './decide';
import { buildBotPrompt, parseBotAnswer, sanitizeReply } from './prompt';

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
