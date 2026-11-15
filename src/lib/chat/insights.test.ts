import { describe, it, expect } from 'vitest';
import { analyze, dailyOf, exampleOf, fallbackSummary, needsOf, parseSummary, summaryInput, type InMessage } from './insights';

const m = (g: string, body: string, day = 10): InMessage => ({ group_id: g, body, sent_at: `2026-11-${String(day).padStart(2, '0')}T03:00:00Z` });

describe('packages and concerns', () => {
  const msgs = [
    m('a', 'kak paket Juragan itu berapa harganya?'),
    m('a', 'bisa cicil ga kak? soalnya toko lagi sepi'),
    m('b', 'mau tanya paket optimize shopee, hasilnya bisa naik omzet ga?'),
    m('c', 'ada paket meta ads? iklan saya boros banget ROAS rendah'),
    m('d', 'Halo kak'),
    m('d', '   '),
    m('e', 'paket juragan harga berapa ya'),
  ];
  const r = analyze(msgs);

  it('counts the chats and messages that have something to read', () => {
    expect(r.chats).toBe(5);
    expect(r.messages).toBe(6);       // the blank message is skipped
  });
  it('the package asked about by the most chats comes first', () => {
    expect(r.packages[0]).toMatchObject({ key: 'juragan', chats: 2, mentions: 2 });
    expect(r.packages.map((p) => p.key)).toEqual(expect.arrayContaining(['optimize', 'meta']));
  });
  it('concerns are counted per chat, and a message can have several', () => {
    const harga = r.concerns.find((c) => c.key === 'harga')!;
    expect(harga.chats).toBe(2);      // chats a and e ("berapa", "harga"); a's two messages never count a chat twice
    expect(r.concerns.find((c) => c.key === 'sepi')?.chats).toBe(1);
    expect(r.concerns.find((c) => c.key === 'bayar')?.chats).toBe(1);        // "cicil"
    expect(r.concerns.find((c) => c.key === 'iklan')?.chats).toBe(1);        // "boros"
    expect(r.concerns.find((c) => c.key === 'hasil')?.chats).toBe(1);
  });
  it('messages that fit no concern are counted, with examples kept short', () => {
    expect(r.unmatched).toBeGreaterThanOrEqual(1);
    for (const c of r.concerns) for (const e of c.examples) expect(e.length).toBeLessThanOrEqual(140);
  });
  it('words match whole words only (a name that contains "fo" is not Friends Order)', () => {
    expect(analyze([m('x', 'info dong kak')]).packages.find((p) => p.key === 'friends')).toBeUndefined();
    expect(analyze([m('x', 'mau coba fo kak')]).packages.find((p) => p.key === 'friends')?.chats).toBe(1);
  });
  it('an empty period gives zeros, never errors', () => {
    expect(analyze([])).toEqual({ chats: 0, messages: 0, packages: [], concerns: [], unmatched: 0 });
  });
});

describe('examples never carry a phone number or a link', () => {
  it('removes them', () => {
    expect(exampleOf('hubungi saya di +62 812-3456-7890 atau lihat https://toko.id/abc ya kak')).toBe('hubungi saya di atau lihat ya kak');
  });
});

describe('what clients say they need', () => {
  it('the same wording is grouped, the most common first', () => {
    expect(needsOf([{ need: 'Iklan Shopee' }, { need: 'iklan shopee.' }, { need: 'Nego harga' }, { need: '' }, { need: null }, { need: 'ab' }])).toEqual([{ need: 'Iklan Shopee', chats: 2 }, { need: 'Nego harga', chats: 1 }]);
  });
});

describe('the text the AI reads', () => {
  it('has the period, the counts, the packages, the concerns and the needs', () => {
    const t = summaryInput(analyze([m('a', 'paket juragan berapa?')]), [{ need: 'Iklan Shopee', chats: 2 }], 30);
    expect(t).toContain('30 hari terakhir');
    expect(t).toContain('Paket Juragan');
    expect(t).toContain('Iklan Shopee (2 chat)');
  });
});

describe('the days', () => {
  it('chats and messages per Jakarta day, the last 7 days ending today', () => {
    const now = new Date('2026-11-16T05:00:00Z');
    const d = dailyOf([m('a', 'halo kak', 16), m('a', 'mau tanya paket', 16), m('b', 'harga?? berapa', 16), m('a', 'kemarin tanya', 15), { group_id: 'c', body: 'x', sent_at: '2026-11-16T03:00:00Z' }], 7, now);
    expect(d).toHaveLength(7);
    expect(d[6]).toEqual({ day: '2026-11-16', chats: 2, messages: 3 });
    expect(d[5]).toEqual({ day: '2026-11-15', chats: 1, messages: 1 });
    expect(d[0].day).toBe('2026-11-10');
  });
  it('a message just after midnight in Jakarta belongs to the next day', () => {
    const d = dailyOf([{ group_id: 'a', body: 'halo kak', sent_at: '2026-11-15T17:30:00Z' }], 3, new Date('2026-11-16T05:00:00Z'));
    expect(d.find((x) => x.day === '2026-11-16')?.messages).toBe(1);
  });
});

describe('the summary for the BOD', () => {
  const good = JSON.stringify({ executive: 'Selama 7 hari terakhir ada 28 calon client dengan 112 pesan. Paket Juragan paling banyak ditanya.', insights: ['Banyak tanya harga.'], actions: [{ action: 'Siapkan perbandingan paket.', pic: 'Sales', why: 'Harga di 8 chat.' }, { action: 'Kumpulkan testimoni.', pic: 'Orang Lain', why: 'Bukti hasil.' }] });
  it('reads the model JSON, also when it has text around it; an unknown PIC becomes Sales', () => {
    const s = parseSummary(`Berikut:\n${good}\nSelesai`)!;
    expect(s.executive).toContain('28 calon client');
    expect(s.actions.map((a) => a.pic)).toEqual(['Sales', 'Sales']);
  });
  it('rejects an answer it cannot trust', () => {
    expect(parseSummary('bukan json')).toBeNull();
    expect(parseSummary('{"executive": "pendek"}')).toBeNull();
    expect(parseSummary('{"executive": "paragraf yang cukup panjang untuk dibaca direksi", "actions": "salah"}')?.actions).toEqual([]);
  });
  it('without the AI, it is written from the numbers: sample warning, top package, top worry, busiest day', () => {
    const i = analyze([m('a', 'paket juragan berapa harganya'), m('b', 'paket juragan harga berapa')]);
    const f = fallbackSummary(i, [{ need: 'Iklan Shopee', chats: 2 }], 7, [{ day: '2026-11-15', chats: 1, messages: 2 }, { day: '2026-11-16', chats: 2, messages: 5 }]);
    expect(f.executive).toContain('Datanya masih sedikit');
    expect(f.executive).toContain('Paket Juragan (2 chat)');
    expect(f.executive).toContain('2026-11-16');
    expect(f.actions.length).toBeGreaterThan(0);
    expect(fallbackSummary(analyze([]), [], 7).executive).toContain('Belum ada chat');
  });
});
