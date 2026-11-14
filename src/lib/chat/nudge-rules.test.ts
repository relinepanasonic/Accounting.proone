import { describe, it, expect } from 'vitest';
import { dueNudge, LIFETIME_MAX, nudgeText, parseHours, readPick } from './nudge-rules';

const H = 3600000;
const lastIn = new Date('2026-11-14T03:00:00Z');
const at = (h: number) => new Date(lastIn.getTime() + h * H);

describe('when the follow-ups go out', () => {
  it('reads the hours: whole, 1 to 168, sorted, at most 3', () => {
    expect(parseHours('72, 24')).toEqual([24, 72]);
    expect(parseHours([24, 24, 0, 500, 168, 3, 1])).toEqual([1, 3, 24]);
    expect(parseHours('abc')).toEqual([]);
  });

  it('the first after 24 hours of silence, the second after 72, then nothing', () => {
    const hours = [24, 72];
    expect(dueNudge(hours, lastIn, null, at(23))).toBeNull();
    expect(dueNudge(hours, lastIn, null, at(25))).toBe(0);
    const after1 = { inboundAt: lastIn.toISOString(), sent: 1, total: 1 };
    expect(dueNudge(hours, lastIn, after1, at(30))).toBeNull();
    expect(dueNudge(hours, lastIn, after1, at(73))).toBe(1);
    expect(dueNudge(hours, lastIn, { ...after1, sent: 2, total: 2 }, at(200))).toBeNull();
  });

  it('a late nudge (more than 2 days past its time) is skipped, not sent', () => {
    expect(dueNudge([24], lastIn, null, at(24 + 49))).toBeNull();
  });

  it('the count starts again when the lead writes again, but never past the lifetime maximum', () => {
    const old = { inboundAt: new Date(lastIn.getTime() - 5 * 86400000).toISOString(), sent: 2, total: 2 };
    expect(dueNudge([24, 72], lastIn, old, at(25))).toBe(0);
    expect(dueNudge([24, 72], lastIn, { ...old, total: LIFETIME_MAX }, at(25))).toBeNull();
  });
});

describe('the message', () => {
  const slots = [new Date('2026-11-16T03:00:00Z'), new Date('2026-11-16T07:00:00Z'), new Date('2026-11-17T03:00:00Z')];
  it('names the lead, offers three numbered times and the way out', () => {
    const t = nudgeText(0, 'Nico Japar', slots, 30);
    expect(t).toContain('Hi kak Nico');
    expect(t).toContain('konsultasi gratis 30 menit');
    expect(t).toMatch(/1\. Senin 16 Nov, jam 10\.00 WIB\n2\. Senin 16 Nov, jam 14\.00 WIB\n3\. Selasa 17 Nov/);
    expect(t).toContain('(1, 2 atau 3)');
    expect(t).toContain('STOP');
  });
  it('a phone number is not a name; the later nudges read differently', () => {
    expect(nudgeText(1, '628123456', slots, 30)).toMatch(/^Hi kak, masih mau/);
    expect(nudgeText(2, null, slots, 30)).toContain('terakhir dari kami');
  });
});

describe('a number in reply', () => {
  it('picks one of the offered times only', () => {
    expect(readPick('2', 3)).toBe(2);
    expect(readPick('yang 1 aja kak', 3)).toBe(1);
    expect(readPick('no. 3', 3)).toBe(3);
    expect(readPick('4', 3)).toBeNull();
    expect(readPick('2 orang kak', 3)).toBeNull();
    expect(readPick('harga paket 1 berapa', 3)).toBeNull();
  });
});
