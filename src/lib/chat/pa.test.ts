import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/api/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/wa/bot/model', () => ({ askBotModel: vi.fn() }));
import { looksLikeMeeting, parseMeetingAi, parseMeetingTemplate } from './pa';

const NOW = new Date('2026-11-18T03:00:00Z');       // 10:00 WIB, Wednesday 18 Nov 2026

describe('a meeting told to Fefe', () => {
  it('the template', () => {
    const t = parseMeetingTemplate('Hi Fefe\nMeeting Offline\nDengan: Brand X\nTanggal: 19 Nov 26\nJam: 14.00\nLokasi: Kopi Kenangan, Medan\nDurasi: 90', NOW);
    expect(t).toMatchObject({ withWhom: 'Brand X', place: 'Kopi Kenangan, Medan', minutes: 90 });
    expect(t?.start?.toISOString()).toBe('2026-11-19T07:00:00.000Z');
  });
  it('the template with a missing time keeps what it has', () => {
    const t = parseMeetingTemplate('Hi Fefe\nMeeting Offline\nDengan: Brand X\nTanggal: besok\nJam:\nLokasi:', NOW);
    expect(t?.withWhom).toBe('Brand X'); expect(t?.start).toBeNull(); expect(t?.minutes).toBe(60);
  });
  it('a message that is not the template is not read as one', () => {
    expect(parseMeetingTemplate('Hi Fefe\nNama Toko: A', NOW)).toBeNull();
  });
  it('words that look like a meeting request, with a day or a time', () => {
    for (const t of ['Hi Fefe, meeting offline dengan Brand X besok jam 14.00 di Kopi Kenangan', 'tlng bwtin aku jadwal meeting dengan william hari kamis', 'catat ketemu Bu Tati 20 Nov jam 10', 'ada kunjungan ke toko Maju tanggal 25/11/2026']) expect(looksLikeMeeting(t)).toBe(true);
  });
  it('and ones that do not', () => {
    for (const t of ['Hi Fefe masukkan Bu Tati brand furniture 0812', 'Hi Fefe ID 1042 pindah ke Warm', 'meeting tadi lancar', 'besok libur']) expect(looksLikeMeeting(t)).toBe(false);
  });
});

describe('the AI answer about a meeting', () => {
  it('is read, with the time in Jakarta', () => {
    const r = parseMeetingAi('{"meeting":true,"dengan":"Brand X","mulai":"2026-11-19T14:00","menit":45,"lokasi":"Kopi Kenangan"}');
    expect(r).toMatchObject({ meeting: true, withWhom: 'Brand X', minutes: 45, place: 'Kopi Kenangan' });
    expect(r?.start?.toISOString()).toBe('2026-11-19T07:00:00.000Z');
  });
  it('no time, an odd length, or not a meeting', () => {
    expect(parseMeetingAi('{"meeting":true,"dengan":"X","mulai":"","menit":5}')).toMatchObject({ start: null, minutes: 60 });
    expect(parseMeetingAi('{"meeting":false}')?.meeting).toBe(false);
    expect(parseMeetingAi('hmm')).toBeNull();
  });
});
