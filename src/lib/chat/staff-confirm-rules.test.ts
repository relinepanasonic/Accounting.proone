import { describe, it, expect } from 'vitest';
import { confirmQuestion, needsConfirm, readConfirmAnswer, toCandidate } from './staff-confirm-rules';
import type { Match } from './staff-lead';

const M = (id: string, no: number, name: string, pic: string, score: number): Match => ({ client: { id, client_no: no, name, store_name: null, contact_name: pic, phone: null } as any, score });

describe('when Fefe asks "is this the same client?"', () => {
  it('nothing alike: a new lead, no question', () => expect(needsConfirm([], { update: false })).toBeNull());
  it('a sure match (phone, store or brand): no question', () => {
    expect(needsConfirm([M('1', 1042, 'Brand X', 'Tati', 100)], { update: false })).toBeNull();
    expect(needsConfirm([M('1', 1042, 'Brand X', 'Tati', 85), M('2', 1043, 'Y', 'Z', 50)], { update: false })).toBeNull();
  });
  it('only the person looks alike, entering a lead or a meeting: ask', () => {
    expect(needsConfirm([M('1', 1042, 'Furniture', 'Tati', 70)], { update: false })).toHaveLength(1);
  });
  it('changing a lead that is clearly that person: go on', () => expect(needsConfirm([M('1', 1042, 'Furniture', 'Tati', 70)], { update: true })).toBeNull());
  it('several fit equally: ask with up to 3', () => {
    const r = needsConfirm([M('1', 1, 'A', 'Tati', 70), M('2', 2, 'B', 'Tati', 70), M('3', 3, 'C', 'Tati', 70), M('4', 4, 'D', 'Tati', 70)], { update: true });
    expect(r).toHaveLength(3);
  });
  it('a weak guess: ask', () => expect(needsConfirm([M('1', 1042, 'Tati Mebel', '', 50)], { update: true })).toHaveLength(1));
});

describe('the question', () => {
  it('shows the client ID, the brand and the PIC', () => {
    const q = confirmQuestion([toCandidate(M('1', 1042, 'Brand X', 'Bu Tati', 70))]);
    expect(q).toContain('Apakah ini sama dengan client kita?');
    expect(q).toContain('Client ID: 1042'); expect(q).toContain('Brand: Brand X'); expect(q).toContain('Nama PIC: Bu Tati');
    expect(q).toContain('YA'); expect(q).toContain('TIDAK');
  });
  it('with several, it asks for the ID', () => {
    const q = confirmQuestion([toCandidate(M('1', 1042, 'A', 'x', 70)), toCandidate(M('2', 1043, 'B', 'y', 70))]);
    expect(q).toContain('salah satu'); expect(q).toContain('Client ID: 1043');
  });
});

describe('the answer', () => {
  const one = [toCandidate(M('c1', 1042, 'Brand X', 'Tati', 70))];
  const two = [...one, toCandidate(M('c2', 1043, 'Brand Y', 'Tati', 70))];
  it('yes means the one shown', () => { for (const t of ['ya', 'Iya', 'sama', 'iya kak', 'YA']) expect(readConfirmAnswer(t, one)).toEqual({ kind: 'client', clientId: 'c1' }); });
  it('yes with several asks which', () => expect(readConfirmAnswer('ya', two)).toEqual({ kind: 'which' }));
  it('no means a new lead', () => { for (const t of ['tidak', 'Bukan', 'beda', 'lead baru', 'gak']) expect(readConfirmAnswer(t, one)).toEqual({ kind: 'new' }); });
  it('an ID picks the client', () => {
    expect(readConfirmAnswer('1043', two)).toEqual({ kind: 'client', clientId: 'c2' });
    expect(readConfirmAnswer('ID 1042', two)).toEqual({ kind: 'client', clientId: 'c1' });
    expect(readConfirmAnswer('#1999', two)).toEqual({ kind: 'clientNo', no: 1999 });
  });
  it('a short number picks from the list', () => expect(readConfirmAnswer('2', two)).toEqual({ kind: 'client', clientId: 'c2' }));
  it('anything else is not an answer', () => { for (const t of ['', 'Hi Fefe meeting besok jam 14.00', 'klien setuju paket optimizing dan minta penawaran Senin', 'oke makasih']) expect(readConfirmAnswer(t, one)).toBeNull(); });
});
