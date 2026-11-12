import { describe, it, expect } from 'vitest';
import { fetchFonnteGroups, groupIdOf, parseGroups } from './fonnte-groups';

const reply = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status });

describe('groupIdOf / parseGroups', () => {
  it('drops the @g.us suffix and keeps the digits (and the old "number-number" ids)', () => {
    expect(groupIdOf('120363012345678901@g.us')).toBe('120363012345678901');
    expect(groupIdOf(' 628123456789-1600000000@g.us ')).toBe('628123456789-1600000000');
  });
  it('reads data[], cleans names, skips bad ids and repeats', () => {
    const g = parseGroups({ status: true, data: [
      { id: '120363012345678901@g.us', name: '  Community Prof Toko Online -   Group Kawat nyamuk ' },
      { id: '120363012345678901@g.us', name: 'again' },
      { id: 'not-an-id', name: 'x' },
      { id: '120363099999999999@g.us' },
      null,
    ] });
    expect(g).toEqual([
      { waId: '120363012345678901', name: 'Community Prof Toko Online - Group Kawat nyamuk' },
      { waId: '120363099999999999', name: '' },
    ]);
    expect(parseGroups(undefined)).toEqual([]);
  });
});

describe('fetchFonnteGroups', () => {
  it('asks get-whatsapp-group with the token and returns the groups', async () => {
    const seen: any[] = [];
    const f = (async (url: any, init: any) => { seen.push({ url: String(url), init }); return reply({ status: true, data: [{ id: '120363012345678901@g.us', name: 'Tim Sales' }] }); }) as any;
    const r = await fetchFonnteGroups({ token: 'TOK', fetchImpl: f });
    expect(r).toEqual({ ok: true, groups: [{ waId: '120363012345678901', name: 'Tim Sales' }] });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('https://api.fonnte.com/get-whatsapp-group');
    expect(seen[0].init.method).toBe('POST');
    expect(seen[0].init.headers.Authorization).toBe('TOK');
  });

  it('refresh calls fetch-group first, then get-whatsapp-group, and never refreshes on its own', async () => {
    const urls: string[] = [];
    const f = (async (url: any) => { urls.push(String(url)); return reply({ status: true, data: [] }); }) as any;
    await fetchFonnteGroups({ token: 't', fetchImpl: f });
    expect(urls).toEqual(['https://api.fonnte.com/get-whatsapp-group']);
    urls.length = 0;
    await fetchFonnteGroups({ token: 't', refresh: true, fetchImpl: f });
    expect(urls).toEqual(['https://api.fonnte.com/fetch-group', 'https://api.fonnte.com/get-whatsapp-group']);
  });

  it('stops when the refresh itself is refused', async () => {
    const f = (async () => reply({ status: false, detail: 'cannot fetch with disconnected device' })) as any;
    const r = await fetchFonnteGroups({ token: 't', refresh: true, fetchImpl: f });
    expect(r).toMatchObject({ ok: false });
    expect((r as any).error).toContain('disconnected device');
  });

  it('explains what to do when Fonnte has no list yet', async () => {
    const f = (async () => reply({ status: false, detail: 'you have no whatsapp group yet' })) as any;
    const r = await fetchFonnteGroups({ token: 't', fetchImpl: f });
    expect((r as any).error).toMatch(/Refresh from WhatsApp/);
  });

  it('reports a missing token and a network failure', async () => {
    const saved = process.env.FONNTE_TOKEN; delete process.env.FONNTE_TOKEN;
    expect((await fetchFonnteGroups({}) as any).error).toMatch(/FONNTE_TOKEN/);
    process.env.FONNTE_TOKEN = saved ?? '';
    const r = await fetchFonnteGroups({ token: 't', fetchImpl: (async () => { throw new Error('boom'); }) as any });
    expect((r as any).error).toContain('boom');
  });
});
