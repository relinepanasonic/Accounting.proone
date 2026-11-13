import { describe, it, expect } from 'vitest';
import { bookedText, freeSlots, matchSlot, MEET_DEFAULTS, offerSlots, parseDays, slotCode, slotLabel, type MeetSettings } from './meet-rules';

// Friday 13 Nov 2026, 09:00 WIB
const NOW = new Date('2026-11-13T02:00:00Z');
const S: MeetSettings = { ...MEET_DEFAULTS, enabled: true, days: [1, 2, 3, 4, 5], from: '10:00', to: '12:00', minutes: 30, noticeHours: 3, daysAhead: 4 };
const wib = (d: Date) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16).replace('T', ' ');

describe('free times', () => {
  it('inside the hours, after the notice, on working days only', () => {
    const s = freeSlots(S, NOW).map(wib);
    // today 09:00 + 3 h notice = 12:00: nothing left today (the hours end at 12:00); Sat 14 and Sun 15 skipped; Mon 16 four times
    expect(s).toEqual(['2026-11-16 10:00', '2026-11-16 10:30', '2026-11-16 11:00', '2026-11-16 11:30']);
  });
  it('a busy time on the calendar (or another booking) is never offered', () => {
    const busy = [{ start: new Date('2026-11-16T03:15:00Z'), end: new Date('2026-11-16T04:00:00Z') }];   // Mon 10:15 to 11:00 WIB
    expect(freeSlots(S, NOW, busy).map(wib)).toEqual(['2026-11-16 11:00', '2026-11-16 11:30']);
  });
  it('the days setting reads "1,2,3"', () => {
    expect(parseDays('5, 1,3,9,x,3')).toEqual([1, 3, 5]);
  });
});

describe('what the lead sees', () => {
  it('a short offer: at most two times a day, a morning and an afternoon one', () => {
    const wide = { ...S, from: '09:00', to: '17:00', minutes: 60, daysAhead: 6 };
    const offer = offerSlots(freeSlots(wide, NOW)).map(wib);
    expect(offer[0]).toBe('2026-11-13 12:00');                  // today, the first time after the notice
    expect(offer.filter((x) => x.startsWith('2026-11-16'))).toEqual(['2026-11-16 09:00', '2026-11-16 13:00']);
    expect(offer.length).toBeLessThanOrEqual(6);
  });
  it('times are written the Indonesian way, in WIB', () => {
    expect(slotLabel(new Date('2026-11-17T03:00:00Z'))).toBe('Selasa 17 Nov, jam 10.00 WIB');
    expect(slotCode(new Date('2026-11-17T03:00:00Z'))).toBe('2026-11-17T10:00+07:00');
  });
  it('the bot can only book a time that is really free', () => {
    const free = freeSlots(S, NOW);
    expect(matchSlot('2026-11-16T10:30+07:00', free)?.toISOString()).toBe('2026-11-16T03:30:00.000Z');
    expect(matchSlot('2026-11-16T10:45+07:00', free)).toBeNull();
    expect(matchSlot('besok jam 10', free)).toBeNull();
  });
  it('the confirmation always carries the right time and the Meet link', () => {
    const t = bookedText(new Date('2026-11-17T03:00:00Z'), 30, 'https://meet.google.com/abc-defg-hij');
    expect(t).toContain('Selasa 17 Nov, jam 10.00 WIB (30 menit)');
    expect(t).toContain('https://meet.google.com/abc-defg-hij');
  });
});
