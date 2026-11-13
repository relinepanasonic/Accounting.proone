import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from './cache';

const upserts: Array<{ table: string; row: any }> = [];
let state: any = null;
let firstMsg: any = null;
let sourcesRows: any[] = [];
let group: any = { id: 'g1' };

vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, not: () => chain, order: () => chain, limit: () => chain, is: () => chain, in: () => chain, gte: () => chain,
        upsert: async (row: any) => { upserts.push({ table, row }); return { error: null }; },
        maybeSingle: async () => ({ data: table === 'chat_state' ? state : table === 'wa_messages' ? firstMsg : table === 'wa_groups' ? group : null }),
        then: (res: any) => res({ data: table === 'lead_sources' ? sourcesRows : [], error: null }),
      };
      return chain;
    },
  }),
}));
import { captureLeadSource, setChatSource } from './sources';

const META = { id: 'm1', name: 'Meta Ads: Promo Sultan', channel: 'meta_ads', first_message: 'Halo kak, saya mau tanya Paket Sultan dari iklan Instagram', active: true };
const chatPatch = () => upserts.filter((u) => u.table === 'chat_state').map((u) => u.row);

describe('captureLeadSource', () => {
  beforeEach(() => { clearCache(); upserts.length = 0; state = null; firstMsg = null; sourcesRows = [META]; group = { id: 'g1' }; });

  it('the first message that matches an ad gives the chat that ad as its source (found automatically)', async () => {
    firstMsg = { body: 'Halo kak, saya mau tanya Paket Sultan dari iklan Instagram', sent_at: '2026-11-13T04:00:00Z' };
    expect(await captureLeadSource('w1', 'g1')).toBe('set');
    expect(chatPatch()[0]).toMatchObject({ group_id: 'g1', workspace_id: 'w1', source_id: 'm1', source_label: 'Meta Ads: Promo Sultan', source_channel: 'meta_ads', source_by: 'auto', first_message_at: '2026-11-13T04:00:00Z' });
  });

  it('an ordinary first message is stored, with the source "unknown"', async () => {
    firstMsg = { body: 'Mau tanya paket dong', sent_at: '2026-11-13T04:00:00Z' };
    expect(await captureLeadSource('w1', 'g1')).toBe('unknown');
    expect(chatPatch()[0]).toMatchObject({ first_message: 'Mau tanya paket dong', source_id: null, source_channel: 'unknown', source_by: 'auto' });
  });

  it('a source a person chose is never changed by the automatic matching', async () => {
    state = { first_message: 'x', source_by: 'Rani', source_id: 'm1' };
    firstMsg = { body: 'Mau tanya paket dong', sent_at: '2026-11-13T04:00:00Z' };
    expect(await captureLeadSource('w1', 'g1', { redo: true })).toBe('kept');
    expect(chatPatch()).toHaveLength(0);
  });

  it('a chat that already has its first message is left alone, unless a re-check is asked for', async () => {
    state = { first_message: 'Mau tanya paket dong', source_by: 'auto', source_id: null };
    expect(await captureLeadSource('w1', 'g1')).toBe('kept');
    expect(chatPatch()).toHaveLength(0);
    expect(await captureLeadSource('w1', 'g1', { redo: true })).toBe('unknown');
  });

  it('a re-check matches an old chat against an ad added later', async () => {
    state = { first_message: 'Halo kak, saya mau tanya Paket Sultan dari iklan Instagram', source_by: 'auto', source_id: null };
    expect(await captureLeadSource('w1', 'g1', { redo: true })).toBe('set');
    expect(chatPatch()[0]).toMatchObject({ source_id: 'm1', source_channel: 'meta_ads' });
    expect(chatPatch()[0]).not.toHaveProperty('first_message_at');          // the date of the first message is not rewritten
  });

  it('nothing is recorded when the lead has written nothing', async () => {
    expect(await captureLeadSource('w1', 'g1')).toBe('none');
    expect(chatPatch()).toHaveLength(0);
  });
});

describe('setChatSource', () => {
  beforeEach(() => { clearCache(); upserts.length = 0; sourcesRows = [META]; firstMsg = { body: 'Halo', sent_at: '2026-11-13T04:00:00Z' }; group = { id: 'g1' }; });

  it('a person sets the source: it is kept with their name', async () => {
    const r = await setChatSource('w1', 'g1', 'm1', { userId: 'u1', name: 'Rani' });
    expect(r).toMatchObject({ ok: true, source: { id: 'm1', label: 'Meta Ads: Promo Sultan', channel: 'meta_ads' } });
    expect(chatPatch()[0]).toMatchObject({ source_id: 'm1', source_by: 'Rani' });
  });

  it('clearing it (null) goes back to automatic and "unknown"', async () => {
    await setChatSource('w1', 'g1', null, { userId: 'u1', name: 'Rani' });
    expect(chatPatch()[0]).toMatchObject({ source_id: null, source_channel: 'unknown', source_by: 'auto' });
  });

  it('refuses a source that does not exist, and a chat that is not in this company', async () => {
    expect(await setChatSource('w1', 'g1', 'nope', { userId: 'u1', name: 'Rani' })).toMatchObject({ ok: false, status: 400 });
    group = null;
    expect(await setChatSource('w1', 'zz', 'm1', { userId: 'u1', name: 'Rani' })).toMatchObject({ ok: false, status: 404 });
    expect(chatPatch()).toHaveLength(0);
  });
});
