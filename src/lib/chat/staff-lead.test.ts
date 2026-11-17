import { describe, it, expect } from 'vitest';
import { isHiFefe, isTestOn, isTestOff, parseLeadCommand, stageFromText, normalizePhone, TEMPLATE } from './staff-lead';

describe('Hi Fefe', () => {
  it('starts the command, in any of the usual spellings', () => {
    for (const t of ['Hi Fefe', 'hi fefe\nNama Toko: X', 'Halo Fefe,', '  hai fefe', 'HI FEFE']) expect(isHiFefe(t)).toBe(true);
  });
  it('a message that only mentions Fefe is not a command', () => {
    for (const t of ['kata Fefe tadi', 'oke', '', 'Hi kak', 'fefe hi']) expect(isHiFefe(t)).toBe(false);
  });
});

describe('the template', () => {
  it('reads every field, spaces and all', () => {
    const f = parseLeadCommand('Hi Fefe\nNama Brand: Kidsmom\nNama Toko         : Kidsmom Official \nNama PIC: Bu Rina\nAlamat: Jl. Melati 5, Bandung\nKategory: Perlengkapan baby\nPipeline: Warm');
    expect(f).toMatchObject({ brand: 'Kidsmom', store: 'Kidsmom Official', pic: 'Bu Rina', address: 'Jl. Melati 5, Bandung', category: 'Perlengkapan baby', stage: 'Warm' });
  });
  it('empty fields stay empty, unknown lines are ignored', () => {
    const f = parseLeadCommand('Hi Fefe\nNama Brand:\nNama Toko: Toko A\nbla bla\nPipeline:');
    expect(f.brand).toBe(''); expect(f.store).toBe('Toko A'); expect(f.stage).toBe('');
  });
  it('the template itself reads as empty', () => expect(Object.values(parseLeadCommand(TEMPLATE)).every((v) => v === '')).toBe(true));
});

describe('the phone line of the template', () => {
  it('"No Hp: 628" left as it is counts as empty; a real number is read', () => {
    expect(parseLeadCommand(['Hi Fefe', 'No Hp: 628', 'Nama Toko: A'].join('\n')).phone).toBe('');
    expect(parseLeadCommand(['Hi Fefe', 'No Hp: 6281234567890'].join('\n')).phone).toBe('6281234567890');
  });
});

describe('the pipeline asked for', () => {
  it('a stage a person may pick', () => {
    expect(stageFromText('Warm')).toEqual({ kind: 'stage', stage: 'Warm' });
    expect(stageFromText('new lead')).toEqual({ kind: 'stage', stage: 'Lead' });
    expect(stageFromText('Meeting Booked')).toEqual({ kind: 'stage', stage: 'Meeting Booked' });
    expect(stageFromText('nego')).toEqual({ kind: 'stage', stage: 'Negotiation' });
    expect(stageFromText('Cold Leads')).toEqual({ kind: 'stage', stage: 'Cold Case' });
    expect(stageFromText('lost')).toEqual({ kind: 'stage', stage: 'Lost' });
  });
  it('the invoice stages are not set from a chat', () => {
    for (const s of ['Invoice', 'deal', 'Active Client', 'Invoice Requested']) expect(stageFromText(s)).toEqual({ kind: 'locked' });
  });
  it('unknown and empty', () => {
    expect(stageFromText('')).toEqual({ kind: 'none' });
    expect(stageFromText('hampir deal')).toEqual({ kind: 'unknown' });
  });
});

describe('phone numbers', () => {
  it('reads the usual ways to write one', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizePhone('81234567890')).toBe('6281234567890');
    expect(normalizePhone('abc')).toBe('');
    expect(normalizePhone('123')).toBe('');
  });
});

describe('test mode', () => {
  it('"Test Fefe" starts it, "Test off" ends it', () => {
    for (const t of ['Test Fefe', 'tes fefe', ' test fefe!']) { expect(isTestOn(t)).toBe(true); expect(isTestOff(t)).toBe(false); }
    for (const t of ['Test off', 'test selesai', 'Test Fefe off', 'tes stop']) { expect(isTestOff(t)).toBe(true); expect(isTestOn(t)).toBe(false); }
  });
  it('ordinary messages are neither', () => {
    for (const t of ['test', 'fefe test paket', 'Hi Fefe', 'apa itu paket Lapak?', '']) { expect(isTestOn(t)).toBe(false); expect(isTestOff(t)).toBe(false); }
  });
});
