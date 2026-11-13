import { describe, it, expect } from 'vitest';
import { checkDueAt, checkImage, checkStage, cleanLabel, cleanLabelIds, cleanLeadInput, jakartaDay, mayMoveDeal, mediaExt, reminderState } from './crm-link';

describe('labels', () => {
  it('a label needs a short name; an unknown colour becomes blue', () => {
    expect(cleanLabel({ name: '  Hot   lead ', color: 'red' })).toEqual({ ok: true, value: { name: 'Hot lead', color: 'red' } });
    expect(cleanLabel({ name: 'VIP', color: 'neon' })).toEqual({ ok: true, value: { name: 'VIP', color: 'blue' } });
    expect(cleanLabel({ name: '' })).toMatchObject({ ok: false });
    expect(cleanLabel({ name: 'x'.repeat(31) })).toMatchObject({ ok: false });
  });
  it('a chat only gets labels that exist, each once, at most 10', () => {
    expect(cleanLabelIds(['a', 'b', 'a', 'zz'], ['a', 'b', 'c'])).toEqual(['a', 'b']);
    expect(cleanLabelIds('nope', ['a'])).toEqual([]);
    const many = Array.from({ length: 15 }, (_, i) => `l${i}`);
    expect(cleanLabelIds(many, many)).toHaveLength(10);
  });
});

describe('leads', () => {
  it('uses the chat name when no name is typed, and a default title', () => {
    expect(cleanLeadInput({}, 'Budi Santoso')).toEqual({ ok: true, value: { name: 'Budi Santoso', title: 'Lead from WhatsApp', value: 0, store: null, notes: null, salesmanId: null } });
  });
  it('reads a value typed with dots or "Rp", and keeps only a real person id', () => {
    const r: any = cleanLeadInput({ name: 'Sari', title: 'Paket Juragan', value: 'Rp 3.000.000', store: 'Sari Fashion', salesmanId: '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17' }, '');
    expect(r.value).toMatchObject({ name: 'Sari', title: 'Paket Juragan', value: 3000000, store: 'Sari Fashion', salesmanId: '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17' });
    expect((cleanLeadInput({ name: 'x', salesmanId: 'drop table' }, '') as any).value.salesmanId).toBeNull();
  });
  it('refuses a lead with no name at all', () => {
    expect(cleanLeadInput({ name: '  ' }, '')).toMatchObject({ ok: false });
  });
});

describe('stages', () => {
  it('only Lead, Contacted, Negotiation and Cold Case can be chosen by hand', () => {
    expect(checkStage('Contacted')).toEqual({ ok: true, stage: 'Contacted' });
    expect(checkStage('Deal')).toMatchObject({ ok: false, error: expect.stringMatching(/paid/) });
    expect(checkStage('Invoice')).toMatchObject({ ok: false, error: expect.stringMatching(/Accounting/) });
    expect(checkStage('Won')).toMatchObject({ ok: false });
  });
  it('a salesperson moves only their own or unowned deals; admins move any; invoiced deals never move back', () => {
    expect(mayMoveDeal('sales', 'u1', { salesman_id: 'u1', stage: 'Lead' })).toEqual({ ok: true });
    expect(mayMoveDeal('sales', 'u1', { salesman_id: null, stage: 'Lead' })).toEqual({ ok: true });
    expect(mayMoveDeal('sales', 'u1', { salesman_id: 'u2', stage: 'Lead' })).toMatchObject({ ok: false });
    expect(mayMoveDeal('admin', 'u1', { salesman_id: 'u2', stage: 'Negotiation' })).toEqual({ ok: true });
    expect(mayMoveDeal('founder', 'u1', { salesman_id: 'u2', stage: 'Invoice' })).toMatchObject({ ok: false });
  });
});

describe('reminders', () => {
  const now = new Date('2026-11-13T05:00:00Z');     // 12:00 in Jakarta
  it('a reminder is from now to a year ahead', () => {
    expect(checkDueAt('2026-11-14T03:00:00Z', now)).toEqual({ ok: true, iso: '2026-11-14T03:00:00.000Z' });
    expect(checkDueAt('2026-11-13T04:00:00Z', now)).toMatchObject({ ok: false, error: expect.stringMatching(/passed/) });
    expect(checkDueAt('2028-01-01T00:00:00Z', now)).toMatchObject({ ok: false });
    expect(checkDueAt('tomorrow', now)).toMatchObject({ ok: false });
  });
  it('the ERP task gets the Jakarta day (a reminder at 01:00 Jakarta is still that day)', () => {
    expect(jakartaDay('2026-11-13T18:30:00Z')).toBe('2026-11-14');
  });
  it('says whether a reminder is overdue, today or later (Jakarta days)', () => {
    expect(reminderState('2026-11-13T04:00:00Z', now)).toBe('overdue');
    expect(reminderState('2026-11-13T10:00:00Z', now)).toBe('today');
    expect(reminderState('2026-11-13T18:00:00Z', now)).toBe('later');      // 01:00 tomorrow in Jakarta
  });
});

describe('images', () => {
  it('a photo of a sane size is accepted; anything else says why not', () => {
    expect(checkImage('foto.jpg', 2_000_000, 'image/jpeg')).toEqual({ ok: true, ext: 'jpg' });
    expect(checkImage('shot.PNG', 2_000_000, '')).toEqual({ ok: true, ext: 'png' });
    expect(checkImage('a.pdf', 2_000, 'application/pdf')).toMatchObject({ ok: false });
    expect(checkImage('a.jpg', 0, 'image/jpeg')).toMatchObject({ ok: false });
    expect(checkImage('a.jpg', 11 * 1024 * 1024, 'image/jpeg')).toMatchObject({ ok: false, error: expect.stringMatching(/too big/) });
  });
  it('picks a sensible extension for a file that came in', () => {
    expect(mediaExt('image', 'https://x.test/f/abc.JPEG?token=1')).toBe('jpg');
    expect(mediaExt('document', 'https://x.test/f/offer.pdf')).toBe('pdf');
    expect(mediaExt('image', 'https://x.test/f/noext')).toBe('jpg');
    expect(mediaExt('audio', null)).toBe('ogg');
  });
});
