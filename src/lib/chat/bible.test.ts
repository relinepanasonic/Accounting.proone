import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from './cache';

const upserts: any[] = [];
const updates: any[] = [];
let docsResult: any[] = [];
let cfgResult: any = { knowledge: 'SCRIPT' };
const inserts: Array<{ table: string; row: any }> = [];
let docRow: any = null;

vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'missing' } }), remove: async () => ({}), createSignedUploadUrl: async (p: string) => ({ data: { token: 't', path: p }, error: null }) }) },
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, neq: () => chain, limit: () => chain, order: () => chain,
        upsert: async (row: any) => { upserts.push({ table, row }); return { error: null }; },
        update: (row: any) => { updates.push({ table, row }); return chain; },
        insert: (row: any) => { inserts.push({ table, row }); return chain; },
        delete: () => chain,
        maybeSingle: async () => ({ data: table === 'wa_bot_config' ? cfgResult : table === 'ai_bible_docs' ? docRow : null }),
        then: (res: any) => res({ data: table === 'ai_bible_docs' ? docsResult : [], error: null }),
      };
      return chain;
    },
  }),
}));
vi.mock('@/lib/wa/bot/model', () => ({ askBotModel: vi.fn() }));
import { createUploadUrl, deleteDoc, ingestDeck, loadKnowledge, saveDoc, saveSettings } from './bible';

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

const logs = () => inserts.filter((i) => i.table === 'ai_bible_log').map((i) => i.row);
const BY = { userId: 'u1', name: 'Nico' };

describe('the history log', () => {
  beforeEach(() => { clearCache(); inserts.length = 0; updates.length = 0; upserts.length = 0; docRow = { title: 'Sales Deck Nov', text: 'Paket Sultan: Rp 4.000.000', active: true, file_path: 'w1/x.pdf' }; });

  it('a price edited by hand is logged with who did it and how the text changed', async () => {
    expect(await saveDoc('w1', 'd1', { text: 'Paket Sultan: Rp 4.500.000' }, BY)).toEqual({ ok: true });
    expect(logs()).toHaveLength(1);
    expect(logs()[0]).toMatchObject({ workspace_id: 'w1', doc_id: 'd1', doc_title: 'Sales Deck Nov', action: 'edited', by_name: 'Nico' });
    expect(logs()[0].detail).toMatch(/changed by hand/);
  });

  it('a rename, and switching a document on or off, are logged', async () => {
    await saveDoc('w1', 'd1', { title: 'Deck Desember' }, BY);
    await saveDoc('w1', 'd1', { active: false }, BY);
    expect(logs().map((l) => l.action)).toEqual(['renamed', 'switched_off']);
    expect(logs()[0].detail).toBe('"Sales Deck Nov" to "Deck Desember"');
    expect(logs()[1].doc_title).toBe('Sales Deck Nov');
  });

  it('nothing is logged when nothing really changed (same text, same state)', async () => {
    await saveDoc('w1', 'd1', { text: 'Paket Sultan: Rp 4.000.000', active: true }, BY);
    expect(logs()).toHaveLength(0);
  });

  it('an unknown document is a 404 and logs nothing', async () => {
    docRow = null;
    expect(await saveDoc('w1', 'nope', { text: 'x' }, BY)).toMatchObject({ ok: false, status: 404 });
    expect(logs()).toHaveLength(0);
  });

  it('deleting a document is logged with its title (the row itself is gone)', async () => {
    expect(await deleteDoc('w1', 'd1', 'Nico')).toEqual({ ok: true });
    expect(logs()[0]).toMatchObject({ action: 'deleted', doc_title: 'Sales Deck Nov', doc_id: null, by_name: 'Nico' });
  });

  it('switching the bot on and saving the script are logged as settings changes', async () => {
    await saveSettings('w1', { enabled: true, knowledge: 'script' }, BY);
    expect(logs()[0]).toMatchObject({ action: 'settings', doc_title: 'Bot script and settings', by_name: 'Nico' });
    expect(logs()[0].detail).toMatch(/switched ON/);
    expect(logs()[0].detail).toMatch(/script was saved/);
  });

  it('a failed settings change (bad time) logs nothing', async () => {
    await saveSettings('w1', { hours_from: 'late' }, BY);
    expect(logs()).toHaveLength(0);
  });
});
