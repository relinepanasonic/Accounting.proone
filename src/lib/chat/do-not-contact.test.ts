import { describe, it, expect } from 'vitest';
import { doNotContact } from './do-not-contact';

describe('a clear no is never contacted again', () => {
  for (const m of [
    'Jangan ganggu saya lagi', 'jangan hubungi saya lagi ya', 'jangan chat saya', 'Tolong jangan spam', 'ga usah dihubungi lagi',
    'tidak usah chat lagi', 'berhenti menghubungi saya', 'stop kirim pesan', 'Saya tidak minat', 'gak minat kak', 'tidak tertarik',
    'ga butuh', 'hapus nomor saya', 'ini spam', 'saya laporkan ya', 'aku report nomor ini', 'unsubscribe', 'please do not contact me', 'ganggu banget', 'stop', 'Tolong stop ya',
  ]) it(`"${m}"`, () => expect(doNotContact(m)).toBe(true));
});

describe('not now, and real leads, are left alone', () => {
  for (const m of [
    'belum minat dulu kak', 'nanti dulu ya', 'tidak jadi hari ini, besok saja', 'jangan lupa hubungi saya besok ya', 'jangan lupa kirim deck-nya',
    'berapa harga paketnya?', 'saya mau tanya soal iklan shopee', 'kirim proposalnya ya kak', 'toko saya lagi sepi, bisa dibantu?', 'jangan lupa ya meeting jam 3',
    'saya tertarik, tapi tidak punya waktu minggu ini', 'oke makasih kak', '',
  ]) it(`"${m}"`, () => expect(doNotContact(m)).toBe(false));
  it('a long message is a conversation', () => expect(doNotContact('jangan ganggu '.repeat(40))).toBe(false));
});
