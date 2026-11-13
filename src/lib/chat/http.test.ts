import { describe, it, expect, vi, beforeEach } from 'vitest';

const chatUser = vi.fn();
vi.mock('./auth', () => ({ chatUser: (...a: unknown[]) => chatUser(...a), CHAT_ROLES: ['founder', 'superadmin', 'admin', 'sales'] }));
import { chatRoute } from './http';

const ME = { userId: 'u1', name: 'Rani', email: 'r@x.test', role: 'sales', workspaceId: 'w1' };
const req = (method = 'GET', body?: unknown) => new Request('https://erp.test/api/v1/chat/x', { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) });

describe('chatRoute', () => {
  beforeEach(() => { chatUser.mockReset(); chatUser.mockResolvedValue(ME); });

  it('answers 401 without a signed-in person', async () => {
    chatUser.mockResolvedValue(null);
    const res = await chatRoute(async () => ({ ok: true }))(req());
    expect(res.status).toBe(401);
  });

  it('a route with NO dynamic part (params resolve to nothing, as Next does for /agents) still works', async () => {
    const h = vi.fn(async (_c: any) => ({ agents: [] }));
    const res = await chatRoute(h)(req(), { params: Promise.resolve(undefined as any) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agents: [] });
    expect(h.mock.calls[0][0]).toMatchObject({ id: '', me: ME });
  });

  it('a call without any second argument works too', async () => {
    const res = await chatRoute(async () => ({ ok: true as const }))(req());
    expect(res.status).toBe(200);
  });

  it('passes a valid chat id and refuses a malformed one with 404', async () => {
    const h = vi.fn(async (_c: any) => ({ ok: true }));
    const id = '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17';
    expect((await chatRoute(h)(req(), { params: Promise.resolve({ id }) })).status).toBe(200);
    expect(h.mock.calls[0][0].id).toBe(id);
    expect((await chatRoute(h)(req(), { params: Promise.resolve({ id: 'nope' }) })).status).toBe(404);
  });

  it('reads the JSON body when asked, and refuses a body that is not JSON', async () => {
    const h = vi.fn(async ({ body }: any) => ({ got: body }));
    const ok = await chatRoute(h, { needsBody: true })(req('POST', { text: 'hi' }), { params: Promise.resolve({ id: '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17' }) });
    expect(await ok.json()).toEqual({ got: { text: 'hi' } });
    const bad = await chatRoute(h, { needsBody: true })(new Request('https://erp.test/x', { method: 'POST', body: 'not json' }), { params: Promise.resolve({ id: '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17' }) });
    expect(bad.status).toBe(400);
  });

  it('a route limited to some roles answers 403 to everyone else, and runs for the allowed ones', async () => {
    const h = vi.fn(async (_c: any) => ({ ok: true }));
    const guarded = chatRoute(h, { roles: ['founder', 'admin'] });
    const denied = await guarded(req());
    expect(denied.status).toBe(403);
    expect(h).not.toHaveBeenCalled();
    chatUser.mockResolvedValue({ ...ME, role: 'admin' });
    expect((await guarded(req())).status).toBe(200);
  });

  it('a handler error object becomes that HTTP error; a crash becomes a clean 500', async () => {
    const r1 = await chatRoute(async () => ({ ok: false as const, status: 409, error: 'taken' }))(req());
    expect(r1.status).toBe(409);
    expect(await r1.json()).toEqual({ error: 'taken' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r2 = await chatRoute(async () => { throw new Error('db down'); })(req());
    expect(r2.status).toBe(500);
    expect(await r2.json()).toEqual({ error: 'Something went wrong.' });
    spy.mockRestore();
  });
});
