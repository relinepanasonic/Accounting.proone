import { describe, it, expect } from 'vitest';
import { dmyShort, hmDot, inQuietHours, isoJakarta, momAskText, momDue, parseDateText, parseTimeText, readMomReply, whenOf } from './pa-rules';

const NOW = new Date('2026-11-18T03:00:00Z');       // 10:00 WIB on Wednesday 18 Nov 2026

describe('dates and times as people write them', () => {
  it('a date', () => {
    expect(parseDateText('19 Nov 26', NOW)).toEqual({ y: 2026, m: 11, d: 19 });
    expect(parseDateText('19 November 2026', NOW)).toEqual({ y: 2026, m: 11, d: 19 });
    expect(parseDateText('19/11/2026', NOW)).toEqual({ y: 2026, m: 11, d: 19 });
    expect(parseDateText('5-12-26', NOW)).toEqual({ y: 2026, m: 12, d: 5 });
    expect(parseDateText('besok', NOW)).toEqual({ y: 2026, m: 11, d: 19 });
    expect(parseDateText('lusa', NOW)).toEqual({ y: 2026, m: 11, d: 20 });
    expect(parseDateText('hari ini', NOW)).toEqual({ y: 2026, m: 11, d: 18 });
    expect(parseDateText('20 Des', NOW)).toEqual({ y: 2026, m: 12, d: 20 });
  });
  it('not a date', () => {
    for (const t of ['', 'kapan ya', '31 Feb 2026', '45/13/2026']) expect(parseDateText(t, NOW)).toBeNull();
  });
  it('a time', () => {
    expect(parseTimeText('14.00')).toEqual({ h: 14, m: 0 });
    expect(parseTimeText('14:30')).toEqual({ h: 14, m: 30 });
    expect(parseTimeText('jam 2 siang')).toEqual({ h: 14, m: 0 });
    expect(parseTimeText('9 pagi')).toEqual({ h: 9, m: 0 });
    expect(parseTimeText('jam 7 malam')).toEqual({ h: 19, m: 0 });
    expect(parseTimeText('14')).toEqual({ h: 14, m: 0 });
    expect(parseTimeText('')).toBeNull();
    expect(parseTimeText('25.00')).toBeNull();
  });
  it('the moment, in Jakarta time', () => {
    expect(whenOf('19 Nov 26', '14.00', NOW)?.toISOString()).toBe('2026-11-19T07:00:00.000Z');
    expect(whenOf('besok', '09.30', NOW)?.toISOString()).toBe('2026-11-19T02:30:00.000Z');
    expect(whenOf('', '14.00', NOW)).toBeNull();
    expect(isoJakarta('2026-11-19T14:00')?.toISOString()).toBe('2026-11-19T07:00:00.000Z');
    expect(isoJakarta('besok')).toBeNull();
  });
  it('written back the way the team writes it', () => {
    const d = new Date('2026-11-19T07:00:00Z');
    expect(dmyShort(d)).toBe('19 Nov 26'); expect(hmDot(d)).toBe('14.00');
  });
});

describe('asking for the meeting notes', () => {
  it('the message is the one the team asked for', () => {
    expect(momAskText('Herlan', { start: new Date('2026-11-19T07:00:00Z'), with: 'Brand X' })).toBe(['Hi Herlan', 'Fefe butuh dibantu untuk Meeting', '   tanggal : 19 Nov 26 jam 14.00', '   Dengan : Brand X', '   Notes meetingnya apa ya?', '', 'Biar Fefe bantu pencatatan'].join('\n'));
  });
  it('is asked an hour after the meeting ends, by day', () => {
    const visit = new Date('2026-11-19T07:00:00Z');                    // 14.00 WIB
    const ends = new Date('2026-11-19T08:00:00Z');                     // 15.00 WIB
    expect(momDue(visit, ends, new Date('2026-11-19T08:30:00Z'))).toBe(false);   // 30 min after the end
    expect(momDue(visit, ends, new Date('2026-11-19T09:05:00Z'))).toBe(true);    // 16.05 WIB
    expect(momDue(visit, null, new Date('2026-11-19T09:05:00Z'))).toBe(true);    // no end time: one hour long
    expect(momDue(visit, ends, new Date('2026-11-21T08:00:00Z'))).toBe(false);   // too old
  });
  it('not at night: it waits for the morning', () => {
    expect(inQuietHours(new Date('2026-11-19T15:00:00Z'))).toBe(true);           // 22.00 WIB
    expect(inQuietHours(new Date('2026-11-19T21:30:00Z'))).toBe(true);           // 04.30 WIB
    expect(inQuietHours(new Date('2026-11-19T03:00:00Z'))).toBe(false);          // 10.00 WIB
    expect(momDue(new Date('2026-11-19T12:00:00Z'), new Date('2026-11-19T13:00:00Z'), new Date('2026-11-19T15:00:00Z'))).toBe(false);
  });
});

describe('the answer', () => {
  it('notes, skip, or later', () => {
    expect(readMomReply('Klien tertarik paket optimizing, minta penawaran Senin')).toMatchObject({ kind: 'notes' });
    expect(readMomReply('skip')?.kind).toBe('skip');
    expect(readMomReply('Ga ada')?.kind).toBe('skip');
    expect(readMomReply('nanti ya')?.kind).toBe('later');
    expect(readMomReply('belum')?.kind).toBe('later');
    expect(readMomReply('')).toBeNull();
    expect(readMomReply('ok')).toBeNull();
    expect(readMomReply('oke makasih')).toBeNull();
    expect(readMomReply('oke, klien setuju paket optimizing dan minta penawaran')).toMatchObject({ kind: 'notes' });
  });
});

describe('a weekday', () => {
  it('"hari Kamis" is the next Thursday (today is Wednesday), "minggu depan" a week later', () => {
    expect(parseDateText('hari kamis', NOW)).toEqual({ y: 2026, m: 11, d: 19 });
    expect(parseDateText('rabu', NOW)).toEqual({ y: 2026, m: 11, d: 18 });
    expect(parseDateText('senin depan', NOW)).toEqual({ y: 2026, m: 11, d: 30 });
    expect(parseDateText('jumat', NOW)).toEqual({ y: 2026, m: 11, d: 20 });
  });
});
