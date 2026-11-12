import { describe, it, expect } from 'vitest';
import { normalizeIdPhone, responseTimes, memberStats, median, fmtMinutes, type WaMsg, type WaPerson } from './stats';

const msg = (over: Partial<WaMsg>): WaMsg => ({ group_id: 'g1', sender_phone: '6281', sender_name: null, body: 'x', media_type: null, is_from_me: false, sent_at: '2026-11-12T01:00:00Z', ...over });
const at = (m: number) => new Date(Date.UTC(2026, 10, 12, 1, m)).toISOString();

describe('normalizeIdPhone', () => {
  it('turns every Indonesian format into 62...', () => {
    expect(normalizeIdPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeIdPhone('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizeIdPhone('6281234567890')).toBe('6281234567890');
    expect(normalizeIdPhone('81234567890')).toBe('6281234567890');
    expect(normalizeIdPhone(null)).toBe('');
  });
});

describe('median / fmtMinutes', () => {
  it('median handles empty, odd and even', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 3])).toBe(2);
  });
  it('formats minutes', () => {
    expect(fmtMinutes(null)).toBe('-');
    expect(fmtMinutes(0.4)).toBe('<1 min');
    expect(fmtMinutes(12)).toBe('12 min');
    expect(fmtMinutes(135)).toBe('2h 15m');
  });
});

describe('responseTimes', () => {
  const team = new Set(['6299']);
  const isTeam = (p: string | null) => !!p && team.has(p);

  it('credits the first team reply to the customer message that started the clock', () => {
    const r = responseTimes([
      msg({ sender_phone: '6281', sent_at: at(0) }),
      msg({ sender_phone: '6281', sent_at: at(5) }),   // a second customer message does not restart it
      msg({ sender_phone: '6299', sent_at: at(10) }),
    ], isTeam);
    expect(r.get('6299')).toEqual([10]);
  });

  it('keeps chats apart and ignores replies over 24 hours', () => {
    const r = responseTimes([
      msg({ group_id: 'g1', sender_phone: '6281', sent_at: at(0) }),
      msg({ group_id: 'g2', sender_phone: '6282', sent_at: at(1) }),
      msg({ group_id: 'g2', sender_phone: '6299', sent_at: at(4) }),
      msg({ group_id: 'g1', sender_phone: '6299', sent_at: at(60 * 25) }),
    ], isTeam);
    expect(r.get('6299')).toEqual([3]);
  });

  it('a team message with nobody waiting counts nothing', () => {
    expect(responseTimes([msg({ sender_phone: '6299' })], isTeam).size).toBe(0);
  });
});

describe('memberStats', () => {
  const sari: WaPerson = { phone: '6281', name: 'Sari', role: 'sales', userId: 'u1', isTeam: true };
  const budi: WaPerson = { phone: '', name: 'Budi', role: 'sales', userId: 'u2', isTeam: true };
  const byPhone = new Map([['6281', sari]]);

  it('lists the roster even with no messages, and counts media and groups', () => {
    const rows = memberStats([
      msg({ sender_phone: '6281', group_id: 'g1', sent_at: at(0) }),
      msg({ sender_phone: '6281', group_id: 'g2', media_type: 'image', sent_at: at(9) }),
    ], [sari, budi], byPhone, new Map([['6281', [4, 6]]]));
    const s = rows.find((r) => r.name === 'Sari')!;
    expect(s).toMatchObject({ messages: 2, media: 1, groups: 2, lastAt: at(9), replies: 2, medianReplyMin: 5 });
    expect(rows.find((r) => r.name === 'Budi')!.messages).toBe(0);
  });

  it('an unknown number still shows up, named from the chat', () => {
    const rows = memberStats([msg({ sender_phone: '6277', sender_name: 'Tamu' })], [], new Map(), new Map());
    expect(rows[0]).toMatchObject({ phone: '6277', name: 'Tamu', role: null, messages: 1 });
  });
});
