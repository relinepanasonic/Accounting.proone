import { describe, it, expect } from 'vitest';
import { healthOf, workingHours } from './health-rules';

const at = (s: string) => new Date(s);

describe('working hours', () => {
  it('Monday to Saturday, 08:00 to 20:00 Jakarta', () => {
    expect(workingHours(at('2026-11-23T03:00:00Z'))).toBe(true);     // Monday 10:00 WIB
    expect(workingHours(at('2026-11-28T03:00:00Z'))).toBe(true);     // Saturday 10:00
    expect(workingHours(at('2026-11-22T03:00:00Z'))).toBe(false);    // Sunday
    expect(workingHours(at('2026-11-23T13:30:00Z'))).toBe(false);    // 20:30 WIB
    expect(workingHours(at('2026-11-23T00:30:00Z'))).toBe(false);    // 07:30 WIB
  });
});

describe('is the sales number delivering', () => {
  const now = at('2026-11-23T05:00:00Z');                             // Monday 12:00 WIB
  it('a recent message and a connected device: fine', () => expect(healthOf({ now, lastIncomingAt: '2026-11-23T03:00:00Z', deviceStatus: 'connect' }).ok).toBe(true));
  it('a disconnected device is a problem at any hour', () => {
    const night = at('2026-11-23T17:00:00Z');
    expect(healthOf({ now: night, lastIncomingAt: '2026-11-23T16:59:00Z', deviceStatus: 'disconnect' })).toMatchObject({ ok: false, reason: 'disconnected' });
  });
  it('silence in working hours is a problem after 6 hours, not before', () => {
    expect(healthOf({ now, lastIncomingAt: '2026-11-22T22:00:00Z', deviceStatus: 'connect' })).toMatchObject({ ok: false, reason: 'silent' });
    expect(healthOf({ now, lastIncomingAt: '2026-11-23T02:00:00Z', deviceStatus: 'connect' }).ok).toBe(true);
  });
  it('silence at night or on Sunday is normal', () => {
    expect(healthOf({ now: at('2026-11-23T16:00:00Z'), lastIncomingAt: '2026-11-22T20:00:00Z', deviceStatus: null }).ok).toBe(true);
    expect(healthOf({ now: at('2026-11-22T05:00:00Z'), lastIncomingAt: '2026-11-20T05:00:00Z', deviceStatus: 'connect' }).ok).toBe(true);
  });
  it('never any message, in working hours: a problem', () => expect(healthOf({ now, lastIncomingAt: null, deviceStatus: null })).toMatchObject({ ok: false, reason: 'silent' }));
  it('the text says days after two days', () => expect(healthOf({ now, lastIncomingAt: '2026-11-19T13:28:00Z', deviceStatus: 'connect' }).text).toContain('3 days'));
});
