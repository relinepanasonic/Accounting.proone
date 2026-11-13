import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from './cache';

const upserts: any[] = [];
const updates: any[] = [];
let docsResult: any[] = [];
let cfgResult: any = { knowledge: 'SCRIPT' };

vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'missing' } }), remove: async () => ({}), createSignedUploadUrl: async (p: string) => ({ data: { token: 't', path: p }, error: null }) }) },
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, limit: () => chain, order: () => chain,
        upsert: async (row: any) => { upserts.push({ table, row }); return { error: null }; },
        update: (row: any) => { updates.push({ table, row }); return chain; },
        maybeSingle: async () => ({ data: table === 'wa_bot_config' ? cfgResult : null }),
        then: (res: any) => res({ data: table === 'ai_bible_docs' ? docsResult : [], error: null }),
      };
      return chain;
    },
  }),
}));
vi.mock('@/lib/wa/bot/model', () => ({ askBotModel: vi.fn() }));
import { createUploadUrl, ingestDeck, loadKnowledge, saveSettings } from './bible';

describe('saveSettings', () => {
  beforeEach(() => { clearCache(); upserts.length = 0; });

  it('saves valid settings and clears the cached knowledge', async () => {
    const r = await saveSettings('w1', { enabled: true, persona_name: ' Fefe ', hours_from: '08:30', hours_to: '20:00', max_replies: 5, knowledge: 'script' });
    expect(r).toEqual({ ok: true });
    expect(upserts[0].row).toMatchObject({ workspace_id: 'w1', enabled: true, persona_name: 'Fefe', hours_from: '08:30', hours_to: '20:00', max_replies: 5, knowledge: 'script' });
  });

  it('refuses a bad time, a bad number of messages and empty names', async () => {
    expect(await saveSettings('w1', { hours_from: '8am' })).toMatchObject({ ok: false, status: 400 });
    expect(await saveSettings('w1', { hours_to: '25:00' })).toMatchObject({ ok: false });
    expect(await saveSettings('w1', { max_replies: 0 })).toMatchObject({ ok: false });
    expect(await saveSettings('w1', { max_replies: 11 })).toMatchObject({ ok: false });
    expect(await saveSettings('w1', { persona_name: '  ' })).toMatchObject({ ok: false });
    expect(await saveSettings('w1', { company_name: '' })).toMatchObject({ ok: false });
    expect(upserts).toHaveLength(0);
  });
});

describe('createUploadUrl', () => {
  it('refuses anything but a PDF and gives a path inside the company folder for a PDF', async () => {
    expect(await createUploadUrl('w1', 'deck.pptx', 1000)).toMatchObject({ ok: false, status: 400 });
    const r: any = await createUploadUrl('w1', 'Sales Deck.pdf', 1000);
    expect(r.ok).toBe(true);
    expect(r.path.startsWith('w1/')).toBe(true);
    expect(r).toMatchObject({ token: 't', bucket: 'ai-bible' });
  });
});

describe('ingestDeck', () => {
  it('refuses a file outside the company folder, or with a path trick, before touching anything', async () => {
    expect(await ingestDeck('w1', { path: 'w2/deck.pdf', title: 'x' }, { userId: 'u', name: 'A' })).toMatchObject({ ok: false, status: 400 });
    expect(await ingestDeck('w1', { path: 'w1/../w2/deck.pdf', title: 'x' }, { userId: 'u', name: 'A' })).toMatchObject({ ok: false, status: 400 });
  });
  it('says so when the uploaded file is not there', async () => {
    expect(await ingestDeck('w1', { path: 'w1/2026-11-13-abc-deck.pdf', title: 'Deck' }, { userId: 'u', name: 'A' })).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/not found/i) });
  });
});

describe('loadKnowledge', () => {
  beforeEach(() => { clearCache(); });
  it('joins the bot script and the active documents into the one text the AI reads', async () => {
    cfgResult = { knowledge: 'SCRIPT TEXT' };
    docsResult = [{ title: 'Sales Deck', text: 'Paket Sultan: Rp 4.000.000', text_updated_at: '2026-11-10T03:00:00Z', active: true, status: 'ready' }];
    const k = await loadKnowledge('w1');
    expect(k).toContain('SCRIPT TEXT');
    expect(k).toContain('DOKUMEN: Sales Deck');
    expect(k).toContain('Paket Sultan: Rp 4.000.000');
  });
});
