import { describe, it, expect } from 'vitest';
import { BC_DEFAULTS, composeMessage, daysNeeded, inWindow, isStopWord, jakartaMidnight, nextGapMs, nextOpening, personalize, splitVariants, STOP_FOOTER } from './broadcast-rules';

describe('the message', () => {
  it('wordings are split at "---" lines and rotated by position', () => {
    const m = 'Halo {nama}, ada promo A\n---\nHi kak {nama}, promo B\n  ---  \nPromo C untuk {nama}';
    expect(splitVariants(m)).toHaveLength(3);
    expect(composeMessage(m, 0, 'Budi Santoso')).toBe(`Halo Budi, ada promo A\n\n${STOP_FOOTER}`);
    expect(composeMessage(m, 4, 'Sari')).toContain('Hi kak Sari, promo B');
    expect(composeMessage(m, 5, null)).toContain('Promo C untuk kak');
  });
  it('"kak {nama}" without a name does not say "kak kak"', () => {
    expect(personalize('Hi kak {nama}, apa kabar?', '')).toBe('Hi kak, apa kabar?');
  });
  it('every message ends with the way out', () => {
    expect(composeMessage('Info', 0, 'A').endsWith(STOP_FOOTER)).toBe(true);
    expect(composeMessage('  \n---\n ', 0, 'A')).toBe('');
  });
  it('STOP is only the whole message', () => {
    expect(['STOP', 'stop.', ' Berhenti! ', 'jangan kirim lagi', 'unsubscribe'].every(isStopWord)).toBe(true);
    expect(['stop dulu ya kak, saya mau tanya', 'jangan stop', ''].some(isStopWord)).toBe(false);
  });
});

describe('the pace', () => {
  const S = { ...BC_DEFAULTS, from: '09:00', to: '19:00' };
  it('sends only inside the window (Jakarta time)', () => {
    expect(inWindow(new Date('2026-11-14T03:00:00Z'), S)).toBe(true);    // 10:00 WIB
    expect(inWindow(new Date('2026-11-14T12:30:00Z'), S)).toBe(false);   // 19:30 WIB
    expect(inWindow(new Date('2026-11-13T23:00:00Z'), S)).toBe(false);   // 06:00 WIB
  });
  it('outside the window, waits for the next opening', () => {
    expect(nextOpening(new Date('2026-11-13T23:00:00Z'), S).toISOString()).toBe('2026-11-14T02:00:00.000Z');   // 06:00 -> 09:00 same day
    expect(nextOpening(new Date('2026-11-14T12:30:00Z'), S).toISOString()).toBe('2026-11-15T02:00:00.000Z');   // 19:30 -> 09:00 next day
    const inside = new Date('2026-11-14T03:00:00Z');
    expect(nextOpening(inside, S)).toBe(inside);
  });
  it('today starts at midnight Jakarta', () => {
    expect(jakartaMidnight(new Date('2026-11-14T03:00:00Z')).toISOString()).toBe('2026-11-13T17:00:00.000Z');
  });
  it('a random pause between the two settings', () => {
    expect(nextGapMs({ gapMin: 90, gapMax: 240 }, 0)).toBe(90000);
    expect(nextGapMs({ gapMin: 90, gapMax: 240 }, 1)).toBe(240000);
  });
  it('estimates the days a broadcast takes', () => {
    expect(daysNeeded(100, { ...S, dailyMax: 40 })).toBe(3);
    expect(daysNeeded(10, S)).toBe(1);
  });
});
