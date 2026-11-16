import { describe, it, expect } from 'vitest';
import { notALeadReason } from './not-a-lead';

describe('verification codes are not leads', () => {
  const codes = [
    '11049 is your Facebook confirmation code',
    'G-482913 is your Google verification code.',
    'Kode OTP Anda 482913. Jangan bagikan kode ini kepada siapa pun.',
    'Your WhatsApp code: 482-913. Do not share this code with anyone.',
    'JANGAN BERIKAN kode ini ke siapa pun. Kode verifikasi: 5521',
    'Use 884213 as your login code',
    'Your security code is 1234',
  ];
  for (const c of codes) it(`"${c.slice(0, 40)}..."`, () => expect(notALeadReason(c, '+447710173736')).toMatch(/verification code/));
});

describe('a company auto-greeting is not a lead', () => {
  const greet = 'Halo kak, Terima kasih sudah menghubungi DataPinter\n\n* Sebelumnya dengan kakak siapa aku berbicara saat ini ?';
  it('with a customer-service name', () => expect(notALeadReason(greet, 'Data Pinter Customer Service')).toMatch(/automatic greeting/));
  it('but the same words from a person named like a person are left alone', () => expect(notALeadReason(greet, 'Budi Santoso')).toBeNull());
});

describe('real leads are never filtered', () => {
  for (const msg of [
    'Hi, saya mau tanya tentang optimasi toko shopee',
    'Kira2 200jt sebulan, saya kira2 bisa dibantu apa y?',
    'kak paket juragan itu include apa aja? bisa meeting jam 10 besok?',
    'toko saya jual kawat nyamuk, tapi lagi sepi pembeli',
    'Saya Nico, jualan kulkas di Shopee. Iklan saya boncos terus',
    'Boleh kak. Apa bisa besok di aturkan meeting jam 15.09',
    'kode produk saya SKU-1234 kak, tolong dicek',
    'Berapa harganya? Saya transfer hari ini',
  ]) it(`"${msg.slice(0, 40)}..."`, () => expect(notALeadReason(msg, 'Nico Japar')).toBeNull());
  it('empty gives nothing', () => { expect(notALeadReason('', 'x')).toBeNull(); expect(notALeadReason(null)).toBeNull(); });
});
