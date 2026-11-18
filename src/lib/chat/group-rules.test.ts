import { describe, it, expect } from 'vitest';
import { chainOf, classifyGroupMessage, cleanBubbles, DM_LINES, GROUP_MAX_PER_DAY, japriAllowed, mayAnswerNow, parseGroupAnswer, worthAnswering } from './group-rules';

describe('what Fefe reacts to in a group', () => {
  it('a real question about selling on a marketplace', () => {
    for (const t of ['Kak gimana caranya biar toko Shopee ga sepi? produk udah 50 tapi order dikit', 'Iklan shopee saya boncos terus, ROAS cuma 2, enaknya gimana ya?', 'Ada yang tau cara naikin rating toko di tokopedia?']) expect(classifyGroupMessage(t)).toBe('question');
  });
  it('someone showing their store or their work gets a cheer', () => {
    for (const t of ['Alhamdulillah omzet toko shopee saya akhirnya tembus 50 juta bulan ini', 'Baru launching toko di tiktok shop nih, ini hasil foto produk saya', 'ini toko saya guys, baru buka seminggu udah ada order']) expect(classifyGroupMessage(t)).toBe('flex');
  });
  it('not chatter, not another topic, not an advert', () => {
    for (const t of ['siap kak', 'Selamat pagi semua, semoga hari ini lancar jualannya', 'Gimana cara masak rendang yang enak?', 'WTS ready stock baju murah, wa.me/628123456789', 'Open reseller dropship, join grup kami https://chat.whatsapp.com/xyz', 'Jasa edit foto produk murah, hubungi saya 081234567890', '']) expect(classifyGroupMessage(t)).toBeNull();
  });
  it('worthAnswering is only the questions', () => {
    expect(worthAnswering('Iklan shopee saya boncos terus, ROAS cuma 2, enaknya gimana ya?')).toBe(true);
    expect(worthAnswering('Alhamdulillah omzet toko shopee saya akhirnya tembus 50 juta bulan ini')).toBe(false);
  });
});

describe('how often Fefe talks', () => {
  const now = new Date('2026-11-17T08:00:00Z');
  const none = { turns: 0, lastAt: null, invited: false };
  const h = (o: Partial<Parameters<typeof mayAnswerNow>[0]> = {}) => ({ lastAnswerAt: null, answersToday: 0, chain: none, ...o });
  it('free to talk', () => expect(mayAnswerNow(h(), now)).toEqual({ ok: true }));
  it('a limit per group per day', () => expect(mayAnswerNow(h({ answersToday: GROUP_MAX_PER_DAY }), now)).toMatchObject({ ok: false }));
  it('a pause before a NEW conversation in the group', () => {
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:50:00Z' }), now)).toMatchObject({ ok: false });
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:30:00Z' }), now)).toEqual({ ok: true });
  });
  it('the person she is talking to may follow up at once (after a short pause), up to a few turns', () => {
    const chain = { turns: 2, lastAt: '2026-11-17T07:55:00Z', invited: false };
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:55:00Z', chain }), now)).toEqual({ ok: true });
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:59:50Z', chain }), now)).toMatchObject({ ok: false });
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:55:00Z', chain: { ...chain, turns: 6 } }), now)).toMatchObject({ ok: false });
  });
});

describe('the conversation with one person', () => {
  const now = new Date('2026-11-17T08:00:00Z');
  it('counts the answers that follow each other within 30 minutes', () => {
    const c = chainOf([{ at: '2026-11-17T07:55:00Z', reply: 'a' }, { at: '2026-11-17T07:40:00Z', reply: 'b' }, { at: '2026-11-17T07:20:00Z', reply: 'c' }], now);
    expect(c.turns).toBe(3);
    expect(chainOf([{ at: '2026-11-17T05:00:00Z', reply: 'old' }], now).turns).toBe(0);
  });
  it('notices that the japri invitation was already made', () => {
    expect(chainOf([{ at: '2026-11-17T07:55:00Z', reply: 'x\nkl mau tanya tanya lebih detail boleh japri saya ya guys' }], now).invited).toBe(true);
  });
  it('japri only after 3 to 5 turns, and once', () => {
    const c = { turns: 0, lastAt: null, invited: false };
    for (const seed of [0, 1, 2]) {
      expect(japriAllowed(1, seed, c)).toBe(false);
      expect(japriAllowed(2, seed, c)).toBe(false);
      expect(japriAllowed(5, seed, c)).toBe(true);
    }
    expect(japriAllowed(3, 0, c)).toBe(true);
    expect(japriAllowed(3, 2, c)).toBe(false);
    expect(japriAllowed(9, 0, { ...c, invited: true })).toBe(false);
  });
  it('a follow-up counts even without a marketplace word', () => {
    expect(classifyGroupMessage('kenapa gitu kak?')).toBeNull();
    expect(classifyGroupMessage('kenapa gitu kak?', { followUp: true })).toBe('question');
    expect(classifyGroupMessage('oke makasih ya', { followUp: true })).toBeNull();
  });
});

describe('no written laughter', () => {
  it('wkwk, haha and hehe are taken out', () => {
    const out = cleanBubbles(['Waduh, boncos terus emang bikin pusing kak wkwk. Coba hitung ROAS impas', 'hahaha santai guys', 'wkwkwk', 'seru juga hehe nih'], { dm: false });
    expect(out.join(' ')).not.toMatch(/wk|haha|hehe/i);
    expect(out).toContain('Waduh, boncos terus emang bikin pusing kak. Coba hitung ROAS impas');
    expect(out).toContain('santai guys');
    expect(out).not.toContain('');
  });
});

describe('the answer model output', () => {
  it('reads the JSON with its short bubbles', () => {
    expect(parseGroupAnswer('{"bicara":true,"jenis":"puji","pesan":["wah kereeeen kak","tokonya rapi banget"],"japri":false}')).toEqual({ talk: true, bubbles: ['wah kereeeen kak', 'tokonya rapi banget'], dm: false });
    expect(parseGroupAnswer('{"bicara":false}')?.talk).toBe(false);
    expect(parseGroupAnswer('hmm')).toBeNull();
  });
});

describe('the bubbles that are sent', () => {
  it('are short and at most three', () => {
    const out = cleanBubbles(['satu '.repeat(80), 'dua', 'tiga ya guys', 'empat ga boleh muncul'], { dm: false });
    expect(out).toHaveLength(3);
    expect(Math.max(...out.map((x) => x.length))).toBeLessThanOrEqual(170);
  });
  it('carry no link, no number, no stars and nothing that sells', () => {
    const out = cleanBubbles(['**Coba cek** judulnya kak https://bit.ly/abc', 'chat aja 0812-3456-7890 ya', 'ambil paket kami dong, harga Rp 2 juta', 'ROAS impas itu 1 dibagi margin bersih guys'], { dm: false });
    expect(out.join(' ')).not.toMatch(/bit\.ly|0812|\*|paket|harga|Rp/i);
    expect(out).toContain('ROAS impas itu 1 dibagi margin bersih guys');
  });
  it('the japri line is added last, and only when asked for', () => {
    const withDm = cleanBubbles(['wah iklannya boncos ya', 'cek dulu margin bersihnya guys'], { dm: true });
    expect(DM_LINES).toContain(withDm[withDm.length - 1]);
    expect(withDm[withDm.length - 1]).toContain('japri');
    const without = cleanBubbles(['wah iklannya boncos ya'], { dm: false });
    expect(without.some((b) => /japri/i.test(b))).toBe(false);
  });
  it('nothing usable means nothing is sent', () => expect(cleanBubbles(['', 'ok', 'hubungi kami konsultasi gratis'], { dm: true })).toEqual([]));
});
