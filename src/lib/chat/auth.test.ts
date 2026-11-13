import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from './cache';

const getUser = vi.fn();
const queries: string[] = [];
vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: (table: string) => {
      queries.push(table);
      const result = table === 'wa_devices' ? { data: { workspace_id: 'w1' } } : { data: { role: 'sales' } };
      const chain: any = { select: () => chain, eq: () => chain, ilike: () => chain, limit: () => chain, maybeSingle: async () => result };
      return chain;
    },
  }),
}));
vi.mock('@/lib/auth/founders', () => ({ isFounderEmail: (e?: string | null) => e === 'boss@x.test' }));
import { chatUser } from './auth';

const withToken = (t: string) => new Request('https://erp.test/x', { headers: { Authorization: `Bearer ${t}` } });
const TOKEN = 'aaa.bbb.ccc';
const user = { id: 'u1', email: 'rani@x.test', user_metadata: { full_name: 'Rani' } };

describe('chatUser', () => {
  beforeEach(() => { clearCache(); getUser.mockReset(); queries.length = 0; });

  it('knows a signed-in salesperson, with name and company', async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await chatUser(withToken(TOKEN))).toEqual({ userId: 'u1', name: 'Rani', email: 'rani@x.test', role: 'sales', workspaceId: 'w1' });
  });

  it('asks Supabase only once for repeated calls with the same token (the inbox polls every few seconds)', async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    for (let i = 0; i < 5; i++) await chatUser(withToken(TOKEN));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(queries.filter((t) => t === 'wa_devices')).toHaveLength(1);
  });

  it('a refused token is never kept: a second try asks again', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    expect(await chatUser(withToken(TOKEN))).toBeNull();
    expect(await chatUser(withToken(TOKEN))).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('refuses a missing or malformed token without calling Supabase', async () => {
    expect(await chatUser(new Request('https://erp.test/x'))).toBeNull();
    expect(await chatUser(withToken('not-a-jwt'))).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('a founder is let in without a workspace membership row', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u9', email: 'boss@x.test', user_metadata: {} } }, error: null });
    expect((await chatUser(withToken('ddd.eee.fff')))?.role).toBe('founder');
  });
});
