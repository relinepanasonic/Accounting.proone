import { describe, it, expect } from 'vitest';
import { askText, meetCode, readAssignReply } from './meeting-assign-rules';

describe("Herlan's answer", () => {
  it('1, 2 and 3, or the name', () => {
    expect(readAssignReply('1')?.pick).toBe('herlan');
    expect(readAssignReply('Herlan')?.pick).toBe('herlan');
    expect(readAssignReply('saya aja')?.pick).toBe('herlan');
    expect(readAssignReply('2')?.pick).toBe('velly');
    expect(readAssignReply('velly')?.pick).toBe('velly');
    expect(readAssignReply('3')?.pick).toBe('both');
    expect(readAssignReply('berdua')?.pick).toBe('both');
    expect(readAssignReply('Herlan dan Velly')?.pick).toBe('both');
  });
  it('may name the meeting by its code', () => {
    expect(readAssignReply('M7A3B 2')).toEqual({ pick: 'velly', code: 'M7A3B' });
    expect(readAssignReply('3 m0a1b')).toEqual({ pick: 'both', code: 'M0A1B' });
  });
  it('anything else is not an answer', () => {
    for (const t of ['', 'oke makasih', 'Hi Fefe Toko A pindah ke Warm', '4', '12', 'nanti ya']) expect(readAssignReply(t)).toBeNull();
  });
});

describe('the question', () => {
  it('names the lead, the time and the three choices', () => {
    const id = '7a3b9c00-1111-2222-3333-444444444444';
    const t = askText({ code: meetCode(id), lead: 'Bu Tati', store: 'Furniture Jaya', when: 'Kamis 19 Nov, jam 10.00 WIB', meetUrl: 'https://meet.google.com/abc' });
    expect(t).toContain('Bu Tati (Furniture Jaya)');
    expect(t).toContain('1 = Herlan'); expect(t).toContain('2 = Velly'); expect(t).toContain('3 = Berdua');
    expect(t).toContain('Kode: M7A3B');
    expect(meetCode(id)).toBe('M7A3B');
  });
});
