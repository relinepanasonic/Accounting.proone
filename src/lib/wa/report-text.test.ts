import { describe, it, expect } from 'vitest';
import { buildTranscript, cleanActionItems, jakartaDate, whatsappText, groupPrompt } from './report-text';
import type { WaMsg, WaPerson } from './stats';

const m = (over: Partial<WaMsg>): WaMsg => ({ group_id: 'g', sender_phone: '6281', sender_name: 'Sari', body: 'halo', media_type: null, is_from_me: false, sent_at: '2026-11-12T02:41:00Z', ...over });
const sari: WaPerson = { phone: '6281', name: 'Sari W', role: 'sales', userId: 'u1', isTeam: true };

describe('jakartaDate', () => {
  it('rolls over at 17:00 UTC', () => {
    expect(jakartaDate(new Date('2026-11-12T16:59:00Z'))).toBe('2026-11-12');
    expect(jakartaDate(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13');
  });
});

describe('buildTranscript', () => {
  it('shows Jakarta time, the ERP name and role, the phone, and media', () => {
    const t = buildTranscript([m({ body: 'order  masuk\n3 pcs' }), m({ sender_phone: '6277', sender_name: 'Tamu', media_type: 'image', body: null, sent_at: '2026-11-12T02:45:00Z' })], new Map([['6281', sari]]));
    expect(t).toBe('[11-12 09:41] Sari W (sales, +6281): order masuk 3 pcs\n[11-12 09:45] Tamu (+6277): [image] ');
  });
  it('marks our own device', () => {
    expect(buildTranscript([m({ is_from_me: true })], new Map())).toContain('our device (+6281)');
  });
  it('drops the OLDEST lines when too long and says so', () => {
    const msgs = Array.from({ length: 50 }, (_, i) => m({ body: `message number ${i}` }));
    const t = buildTranscript(msgs, new Map(), 600);
    expect(t.startsWith('(')).toBe(true);
    expect(t).toContain('message number 49');
    expect(t).not.toContain('message number 0\n');
  });
});

describe('cleanActionItems', () => {
  it('keeps good items and cleans phone and date', () => {
    const r = cleanActionItems([
      { title: ' Kirim invoice ', detail: ' ke PT A ', owner_phone: '+62 812-3456-7890', due_date: '2026-11-14' },
      { title: 'Cek stok', detail: '', owner_phone: '123', due_date: 'besok' },
      { title: '  ', detail: 'x', owner_phone: null, due_date: null },
      null,
    ]);
    expect(r).toEqual([
      { title: 'Kirim invoice', detail: 'ke PT A', owner_phone: '6281234567890', due_date: '2026-11-14' },
      { title: 'Cek stok', detail: null, owner_phone: null, due_date: null },
    ]);
  });
  it('is safe on garbage and caps the count', () => {
    expect(cleanActionItems(undefined)).toEqual([]);
    expect(cleanActionItems(Array.from({ length: 20 }, (_, i) => ({ title: `t${i}` })), 8)).toHaveLength(8);
  });
});

describe('prompts and text', () => {
  it('the group prompt carries the chat name, the day and the transcript', () => {
    const p = groupPrompt('Tim Sales', '2026-11-12', 'LINE-1');
    expect(p).toContain('"Tim Sales"');
    expect(p).toContain('2026-11-12');
    expect(p.endsWith('LINE-1')).toBe(true);
  });
  it('whatsappText puts the digest before the chats', () => {
    const t = whatsappText('2026-11-12', 'DIGEST', [{ name: 'A', count: 5, summary: 'sa' }]);
    expect(t.indexOf('DIGEST')).toBeLessThan(t.indexOf('*A*'));
    expect(whatsappText('d', null, [])).toBe('*WA REPORT d*');
  });
});
