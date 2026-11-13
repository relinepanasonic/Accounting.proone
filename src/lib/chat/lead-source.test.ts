import { describe, it, expect } from 'vitest';
import { cleanSource, matchSource, normalizeText, similarity, sourceReport, type SourceDef } from './lead-source';

const src = (id: string, name: string, msg: string, over: Partial<SourceDef> = {}): SourceDef => ({ id, name, channel: 'meta_ads', first_message: msg, active: true, ...over });
const META = src('m1', 'Meta Ads: Promo Sultan', 'Halo kak, saya mau tanya Paket Sultan dari iklan Instagram');
const GOOGLE = src('g1', 'Google Ads: Kelola Toko', 'Halo, saya tertarik jasa kelola toko Shopee dari Google', { channel: 'google_ads' });

describe('normalizeText', () => {
  it('lower case, no accents, punctuation or emoji, single spaces', () => {
    expect(normalizeText('  Halo, Kak!!  Saya 😀 mau tanya…  ')).toBe('halo kak saya mau tanya');
    expect(normalizeText('Café')).toBe('cafe');
    expect(normalizeText(null as any)).toBe('');
  });
});

describe('similarity', () => {
  it('the same text, however it is typed, is 1', () => {
    expect(similarity('HALO KAK, saya mau tanya Paket Sultan dari iklan Instagram!', META.first_message)).toBe(1);
  });
  it('the ad text inside a longer message, or the other way round, is high', () => {
    expect(similarity('Halo kak, saya mau tanya Paket Sultan dari iklan Instagram. Boleh minta info?', META.first_message)).toBe(0.95);
    expect(similarity('saya mau tanya Paket Sultan dari iklan', META.first_message)).toBe(0.9);
  });
  it('a lightly edited message still matches by its words; a different one does not', () => {
    expect(similarity('Halo kak saya mau tanya paket Sultan dari iklan di Instagram', META.first_message)).toBeGreaterThanOrEqual(0.8);
    expect(similarity('Kak toko saya kawat nyamuk sepi pembeli', META.first_message)).toBeLessThan(0.3);
  });
  it('a very short message ("halo") says nothing', () => {
    expect(similarity('halo', META.first_message)).toBe(0);
    expect(similarity('', META.first_message)).toBe(0);
  });
});

describe('matchSource', () => {
  it('finds the ad a first message came from, and the best one when several are alike', () => {
    expect(matchSource('Halo kak, saya mau tanya Paket Sultan dari iklan Instagram', [GOOGLE, META])?.source.id).toBe('m1');
    expect(matchSource('Halo, saya tertarik jasa kelola toko Shopee dari Google', [META, GOOGLE])?.source.id).toBe('g1');
    const longer = src('m2', 'Meta Ads: Sultan Promo Nov', 'Halo kak, saya mau tanya Paket Sultan dari iklan Instagram promo November');
    expect(matchSource('Halo kak, saya mau tanya Paket Sultan dari iklan Instagram promo November', [META, longer])?.source.id).toBe('m2');
  });
  it('no match for an ordinary message, and switched-off sources are ignored', () => {
    expect(matchSource('Mau tanya paket dong', [META, GOOGLE])).toBeNull();
    expect(matchSource(META.first_message, [{ ...META, active: false }])).toBeNull();
  });
});

describe('cleanSource', () => {
  it('accepts a complete source and cleans it', () => {
    expect(cleanSource({ name: '  Meta   Ads: Promo ', channel: 'meta_ads', first_message: 'Halo kak, saya dari iklan Instagram' })).toEqual({ ok: true, value: { name: 'Meta Ads: Promo', channel: 'meta_ads', first_message: 'Halo kak, saya dari iklan Instagram' } });
  });
  it('says what is missing', () => {
    expect(cleanSource({ name: '', channel: 'meta_ads', first_message: 'Halo kak, saya dari iklan' })).toMatchObject({ ok: false });
    expect(cleanSource({ name: 'x', channel: 'radio', first_message: 'Halo kak, saya dari iklan' })).toMatchObject({ ok: false, error: expect.stringMatching(/where the ad runs/) });
    expect(cleanSource({ name: 'x', channel: 'meta_ads', first_message: 'halo' })).toMatchObject({ ok: false });
    expect(cleanSource({ name: 'x', channel: 'meta_ads', first_message: 'a '.repeat(400) })).toMatchObject({ ok: false });
  });
});

describe('sourceReport', () => {
  const at = '2026-11-10T03:00:00Z';
  const chats = [
    { group_id: 'a', wa_id: '6281200000001', first_message_at: at, source_id: 'm1', source_label: 'Meta Ads: Promo Sultan', source_channel: 'meta_ads' },
    { group_id: 'b', wa_id: '6281200000002', first_message_at: at, source_id: 'm1', source_label: 'Meta Ads: Promo Sultan', source_channel: 'meta_ads' },
    { group_id: 'c', wa_id: '6281200000003', first_message_at: at, source_id: 'g1', source_label: 'Google Ads: Kelola Toko', source_channel: 'google_ads' },
    { group_id: 'd', wa_id: '6281200000004', first_message_at: at, source_id: null, source_label: null, source_channel: 'unknown' },
    { group_id: 'e', wa_id: '6281200000005', first_message_at: at, source_id: null, source_label: null, source_channel: null },
  ];
  const clients = [{ id: 'k1', phone: '0812-0000-0001' }, { id: 'k3', phone: '+62 812 0000 0003' }];
  const deals = [{ client_id: 'k1', stage: 'Deal', value: '3000000' }, { client_id: 'k1', stage: 'Negotiation', value: 5000000 }, { client_id: 'k3', stage: 'Lead', value: 0 }];

  it('counts leads per source, the ones that are clients (by phone), their deals, and the won deals with their value', () => {
    const r = sourceReport(chats, clients, deals);
    const m1 = r.rows.find((x) => x.key === 'm1')!;
    expect(m1).toMatchObject({ leads: 2, clients: 1, deals: 2, won: 1, wonValue: 3000000, channel: 'meta_ads' });
    expect(r.rows.find((x) => x.key === 'g1')).toMatchObject({ leads: 1, clients: 1, deals: 1, won: 0 });
  });
  it('chats with no source are grouped as "no source found", not lost', () => {
    const r = sourceReport(chats, clients, deals);
    expect(r.rows.find((x) => x.key === 'none:unknown')).toMatchObject({ leads: 2, label: 'No source found' });
  });
  it('adds up by channel and in total, biggest first', () => {
    const r = sourceReport(chats, clients, deals);
    expect(r.channels.map((c) => [c.channel, c.leads])).toEqual([['meta_ads', 2], ['unknown', 2], ['google_ads', 1]].sort((a, b) => (b[1] as number) - (a[1] as number)));
    expect(r.total).toEqual({ leads: 5, clients: 2, deals: 3, won: 1, wonValue: 3000000 });
  });
  it('an empty period gives an empty report', () => {
    expect(sourceReport([], clients, deals)).toEqual({ rows: [], channels: [], total: { leads: 0, clients: 0, deals: 0, won: 0, wonValue: 0 } });
  });
});
