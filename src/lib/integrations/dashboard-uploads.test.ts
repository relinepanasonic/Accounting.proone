import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchUploadLog } from './dashboard-uploads';
import { summarizeUploadLog, type DashboardUploadLog } from './upload-log-shared';

const reply = (status: number, body?: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body } as Response);
afterEach(() => vi.unstubAllGlobals());

describe('fetchUploadLog', () => {
  it('reports a missing key without calling the API', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const r = await fetchUploadLog(3, 'RELINE_API_KEY', undefined, 'https://x.test');
    expect(r).toEqual({ ok: false, error: 'RELINE_API_KEY is not set.' });
    expect(f).not.toHaveBeenCalled();
  });
  it('turns 401 and 400 into clear errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(401)));
    expect(await fetchUploadLog(3, 'K', 'k', 'https://x.test')).toMatchObject({ ok: false, error: expect.stringContaining('401') });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(400)));
    expect(await fetchUploadLog(3, 'K', 'k', 'https://x.test')).toMatchObject({ ok: false, error: expect.stringContaining('400') });
  });
  it('treats a redirect as a missing endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(307)));
    expect(await fetchUploadLog(3, 'K', 'k', 'https://x.test')).toMatchObject({ ok: false, error: expect.stringContaining('redirected') });
  });
  it('accepts an empty feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(200, { admins: [], uploads: [] })));
    expect(await fetchUploadLog(3, 'K', 'k', 'https://x.test')).toMatchObject({ ok: true, admins: [], uploads: [] });
  });
  it('splits ranges longer than 60 days into several calls', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { admins: [{ name: 'Vani' }], uploads: [] }));
    vi.stubGlobal('fetch', f);
    const r = await fetchUploadLog(130, 'K', 'k', 'https://x.test');
    expect(f).toHaveBeenCalledTimes(3);
    expect(r.ok && r.admins).toHaveLength(1);
  });
});

describe('summarizeUploadLog', () => {
  const log = (uploads: DashboardUploadLog['uploads'], admins = [{ name: 'Vani' }, { name: 'Dito' }]): DashboardUploadLog => ({ ok: true, days: ['2026-10-21', '2026-10-20'], admins, uploads });
  const up = (id: string, admin: string, uploadedAt: string) => ({ id, admin, uploadedAt, type: 'Performa' });

  it('buckets by Jakarta day: 18:30 UTC is already the next day in Jakarta', () => {
    const s = summarizeUploadLog(log([up('1', 'Vani', '2026-10-20T18:30:00.000Z'), up('2', 'Vani', '2026-10-20T10:00:00.000Z')]));
    const vani = s.admins.find((a) => a.name === 'Vani')!;
    expect(Object.keys(vani.perDay).sort()).toEqual(['2026-10-20', '2026-10-21']);
    expect(vani.daysActive).toBe(2);
  });
  it('keeps an admin with zero uploads in the list', () => {
    const s = summarizeUploadLog(log([up('1', 'Vani', '2026-10-20T10:00:00.000Z')]));
    const dito = s.admins.find((a) => a.name === 'Dito')!;
    expect(dito.total).toBe(0);
    expect(dito.daysActive).toBe(0);
  });
  it('lists uploaders who are not admins as information only', () => {
    const s = summarizeUploadLog(log([up('1', 'Bulk import', '2026-10-20T10:00:00.000Z')]));
    expect(s.admins.map((a) => a.name)).toEqual(['Dito', 'Vani']);
    expect(s.others).toEqual([{ name: 'Bulk import', total: 1 }]);
  });
  it('handles an empty feed', () => {
    expect(summarizeUploadLog(log([], []))).toEqual({ admins: [], others: [] });
  });
});
