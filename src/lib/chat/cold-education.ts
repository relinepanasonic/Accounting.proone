/**
 * The educational broadcast for COLD LEADS (they chatted with us, got the follow-ups and went quiet): twice a month, on the 1st and the 15th. Never a sales
 * pitch: one useful idea from the Kampus Marketplace e-book (https://profesoronline.id/kampus/ebook/), a way out, and a soft door to the free consultation.
 * Each topic has two wordings (split at "---"), so the messages are not all identical.
 */
const DOOR = 'Kalau mau dibahas untuk toko kakak, konsultasi gratisnya terbuka kapan pun. Balas pesan ini saja ya.';
const MORE = 'Materi lengkapnya ada di Kampus Marketplace: https://profesoronline.id/kampus/ebook/';

export const COLD_TOPICS: string[] = [
  // 1. ROAS and break-even
  `Hi {nama}, Fefe dari Prof Toko Online. Satu tips singkat untuk seller marketplace: sebelum menambah budget iklan, hitung dulu ROAS impas toko kakak.\n\nRumusnya 1 dibagi margin bersih. Misal margin bersih 25%, ROAS impasnya 4. Kalau ROAS iklan di bawah 4, setiap klik justru menggerus untung.\n\n${MORE}\n\n${DOOR}\n---\nHalo {nama}, kami berbagi satu hal yang sering terlewat: ROAS impas. Caranya 1 dibagi margin bersih (margin 20% berarti ROAS impas 5). Iklan baru untung kalau ROAS-nya di atas angka itu.\n\n${MORE}\n\n${DOOR}`,
  // 2. the three jobs of ads
  `Hi {nama}, Fefe lagi. Banyak toko boncos karena semua produk diiklankan dengan cara yang sama. Padahal iklan punya tiga tugas: menguji produk baru, menggemukkan produk yang sudah laku, dan menarik pembeli dengan iklan mandiri. Memisahkannya bikin budget lebih terarah.\n\n${MORE}\n\n${DOOR}\n---\nHalo {nama}, tips hari ini: jangan campur semua produk dalam satu iklan. Pisahkan produk yang masih diuji, yang sudah terbukti laku, dan yang perlu didorong. Budget jadi tidak habis di produk yang salah.\n\n${MORE}\n\n${DOOR}`,
  // 3. read the data: hero / regular / low conversion
  `Hi {nama}, kalau toko kakak punya banyak produk, coba kelompokkan: produk andalan (konversi tinggi), produk biasa, dan produk berkonversi rendah. Budget terbesar sebaiknya ke yang andalan, dan produk berkonversi rendah diperbaiki dulu (foto, judul, harga) sebelum diiklankan lagi.\n\n${MORE}\n\n${DOOR}\n---\nHalo {nama}, satu kebiasaan seller yang tokonya tumbuh: rutin melihat produk mana yang konversinya tinggi dan mana yang rendah. Yang rendah dibenahi dulu, bukan ditambah budget.\n\n${MORE}\n\n${DOOR}`,
  // 4. before paying for ads
  `Hi {nama}, sebelum bayar iklan, cek tiga hal ini: foto utama yang jelas, judul produk dengan kata kunci yang dicari pembeli, dan rating atau ulasan yang cukup. Iklan hanya memperbesar apa yang sudah bagus, jadi tiga hal ini yang menentukan.\n\n${MORE}\n\n${DOOR}\n---\nHalo {nama}, kalau tokonya sepi, jangan langsung tambah iklan. Cek dulu foto utama, judul dengan kata kunci, dan ulasan produk. Iklan akan jauh lebih efektif kalau tiga hal itu sudah rapi.\n\n${MORE}\n\n${DOOR}`,
];

/** "2026-11-A" for the 1st to the 14th and "2026-11-B" from the 15th (Jakarta time): the two sends of a month. */
export function coldSlot(now: Date): string {
  const j = new Date(now.getTime() + 7 * 3600000);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${j.getUTCDate() >= 15 ? 'B' : 'A'}`;
}

/** The message of the slot: the four topics in turn, so the two sends of a month differ and the cycle repeats every two months. */
export function coldMessage(now: Date): string {
  const j = new Date(now.getTime() + 7 * 3600000);
  const n = j.getUTCMonth() * 2 + (j.getUTCDate() >= 15 ? 1 : 0);
  return COLD_TOPICS[n % COLD_TOPICS.length];
}
