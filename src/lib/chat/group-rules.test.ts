import { describe, it, expect } from 'vitest';
import { cleanGroupReply, GROUP_MAX_PER_DAY, mayAnswerNow, parseGroupAnswer, worthAnswering } from './group-rules';

describe('which group messages Fefe may answer', () => {
  it('a real question about selling on a marketplace', () => {
    for (const t of ['Kak gimana caranya biar toko Shopee ga sepi? produk udah 50 tapi order dikit', 'Iklan shopee saya boncos terus, ROAS cuma 2, enaknya gimana ya?', 'Ada yang tau cara naikin rating toko di tokopedia?']) expect(worthAnswering(t)).toBe(true);
  });
  it('not chatter, not a question about something else, not an advert', () => {
    for (const t of ['siap kak', 'Selamat pagi semua, semoga hari ini lancar jualannya', 'Gimana cara masak rendang yang enak?', 'WTS ready stock baju murah, wa.me/628123456789', 'Open reseller dropship, join grup kami https://chat.whatsapp.com/xyz', 'Jasa edit foto produk murah, hubungi saya 081234567890', '']) expect(worthAnswering(t)).toBe(false);
  });
});

describe('how often Fefe answers', () => {
  const now = new Date('2026-11-17T08:00:00Z');
  const h = (o: Partial<Parameters<typeof mayAnswerNow>[0]> = {}) => ({ lastAnswerAt: null, answersToday: 0, personLastAt: null, ...o });
  it('free to answer', () => expect(mayAnswerNow(h(), now)).toEqual({ ok: true }));
  it('a few answers a day per group', () => expect(mayAnswerNow(h({ answersToday: GROUP_MAX_PER_DAY }), now)).toMatchObject({ ok: false }));
  it('a pause between answers in a group', () => {
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:50:00Z' }), now)).toMatchObject({ ok: false });
    expect(mayAnswerNow(h({ lastAnswerAt: '2026-11-17T07:30:00Z' }), now)).toEqual({ ok: true });
  });
  it('not the same person again soon', () => {
    expect(mayAnswerNow(h({ personLastAt: '2026-11-17T04:00:00Z' }), now)).toMatchObject({ ok: false });
    expect(mayAnswerNow(h({ personLastAt: '2026-11-17T00:00:00Z' }), now)).toEqual({ ok: true });
  });
});

describe('the answer', () => {
  it('reads the JSON, and nothing else is trusted', () => {
    expect(parseGroupAnswer('{"jawab":true,"balasan":"Halo kak","ajak":false}')).toEqual({ answer: true, reply: 'Halo kak', invite: false });
    expect(parseGroupAnswer('{"jawab":false}')?.answer).toBe(false);
    expect(parseGroupAnswer('tidak tahu')).toBeNull();
  });
  it('is cleaned: no number, no link but the Kampus, no stars', () => {
    const t = cleanGroupReply('**Coba cek** judul produknya kak, pakai kata kunci yang dicari pembeli. Hubungi 0812-3456-7890 atau lihat https://bit.ly/abc dan https://profesoronline.id/kampus/ebook/ untuk materinya.', { invite: false, salesPhone: '6285758789999' });
    expect(t).not.toMatch(/0812|bit\.ly|\*/);
    expect(t).toContain('https://profesoronline.id/kampus/ebook/');
  });
  it('is short, and a too-short answer is not sent', () => {
    expect(cleanGroupReply('x'.repeat(2000), { invite: false, salesPhone: '' }).length).toBeLessThanOrEqual(700);
    expect(cleanGroupReply('ok', { invite: false, salesPhone: '' })).toBe('');
  });
  it('the invite is one polite line with the sales number, only when asked for', () => {
    const base = 'Coba cek dulu margin bersih dan ROAS impasnya kak, rumusnya 1 dibagi margin bersih.';
    expect(cleanGroupReply(base, { invite: true, salesPhone: '6285758789999' })).toContain('wa.me/6285758789999');
    expect(cleanGroupReply(base, { invite: false, salesPhone: '6285758789999' })).not.toContain('wa.me');
  });
});
