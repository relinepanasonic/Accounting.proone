import { describe, it, expect } from 'vitest';
import { parseAppWeeklyRequest } from './app-weekly-request';

describe('parseAppWeeklyRequest', () => {
  it('accepts a minimal preview request', () => {
    expect(parseAppWeeklyRequest({ source: 'dashboard', store: ' onat.hardware ' })).toEqual({
      ok: true, value: { source: 'dashboard', store: 'onat.hardware', workspace: '', week: null, action: 'preview', resend: false, sentBy: '' },
    });
  });
  it('accepts a full send request (Reline dealer with its workspace, a Monday, who pressed it)', () => {
    const r: any = parseAppWeeklyRequest({ source: 'reline', store: 'Sumber Multi - Cinere', workspace: 'Reline Project 1.0', week: '2026-11-02', action: 'send', resend: true, sentBy: '  Vani  Admin ' });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ source: 'reline', workspace: 'Reline Project 1.0', week: '2026-11-02', action: 'send', resend: true, sentBy: 'Vani Admin' });
  });
  it('refuses a bad source, a missing store, a week that is not a Monday or not a date, and an unknown action', () => {
    expect(parseAppWeeklyRequest({ source: 'x', store: 's' })).toMatchObject({ ok: false });
    expect(parseAppWeeklyRequest({ source: 'dashboard', store: '  ' })).toMatchObject({ ok: false });
    expect(parseAppWeeklyRequest({ source: 'dashboard', store: 's', week: '2026-11-03' })).toMatchObject({ ok: false });     // a Tuesday
    expect(parseAppWeeklyRequest({ source: 'dashboard', store: 's', week: 'next week' })).toMatchObject({ ok: false });
    expect(parseAppWeeklyRequest({ source: 'dashboard', store: 's', action: 'delete' })).toMatchObject({ ok: false });
    expect(parseAppWeeklyRequest(null)).toMatchObject({ ok: false });
  });
  it('resend is only true when it is exactly true', () => {
    expect((parseAppWeeklyRequest({ source: 'dashboard', store: 's', resend: 'yes' }) as any).value.resend).toBe(false);
  });
});
