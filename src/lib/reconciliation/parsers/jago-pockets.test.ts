import { describe, it, expect } from 'vitest';
import { parseJago } from './jago';

const SAMPLE = `PT Bank Jago Tbk berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) dan Bank Indonesia, serta
merupakan peserta penjaminan Lembaga Penjamin Simpanan (LPS). www.jago.com
Pockets Transactions History Halaman 1 dari 2
HERLAN TUNGGANA
In - Harapan Baru 101359144925
Menampilkan transaksi IDR dari Saldo terbaru 21 Oct 2026
01 Jan 2026 - 31 Jan 2026 IDR 17.967.955,32
Tanggal & Waktu Sumber/Tujuan Rincian Transaksi Catatan Jumlah Saldo
Januari 2026
04 Jan 2026
15.15
Hostinger
XENDIT
9360084800000000050
Pembayaran QRIS
ID# 2910561376
domain
profesoronline.id
-234.099 16.131.570,19
05 Jan 2026
10.54
LOSKE COFFEE
SERVICE SU
BCA 9360001430042970944
Pembayaran QRIS
ID# 2914387385
kopi -64.000 16.067.570,19
28 Jan 2026
04.46
Bunga
In - Harapan Baru
Bunga
ID# 260128-MBVW-2HCWJ9
+12.802,08 16.080.372,27
PT Bank Jago Tbk berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) dan Bank Indonesia, serta
merupakan peserta penjaminan Lembaga Penjamin Simpanan (LPS). www.jago.com
Pockets Transactions History Halaman 2 dari 2
Tanggal & Waktu Sumber/Tujuan Rincian Transaksi Catatan Jumlah Saldo
28 Jan 2026
09.58
NICO WINARTA JAPAR
BCA 3882171717
Transfer Masuk
ID# 260128-YHPX-EC3YE8
- +1.000.000,00 17.080.372,27
Info Penting
Dokumen ini adalah daftar Riwayat Transaksi Jago kamu.`;

describe('parseJago: Pockets Transactions History', () => {
  const res = parseJago(SAMPLE.split('\n'));
  const tx = res.data || [];

  it('reads only real transactions: not the header, the date range or the balance line', () => {
    expect(res.success).toBe(true);
    expect(tx).toHaveLength(4);
    expect(tx.map((t) => t.date)).toEqual(['2026-01-04', '2026-01-05', '2026-01-28', '2026-01-28']);
  });
  it('splits who, bank and account, type and notes', () => {
    expect(tx[0]).toMatchObject({ sourceDestination: 'Hostinger', rekFrom: 'XENDIT 9360084800000000050', transactionDetails: 'Pembayaran QRIS', notes: 'domain profesoronline.id', amount: -234099 });
    expect(tx[1]).toMatchObject({ sourceDestination: 'LOSKE COFFEE SERVICE SU', rekFrom: 'BCA 9360001430042970944', notes: 'kopi', amount: -64000 });
  });
  it('keeps the sign and the decimals of the amount', () => {
    expect(tx[2].amount).toBeCloseTo(12802.08, 2);
    expect(tx[3]).toMatchObject({ amount: 1000000, notes: '' });
  });
});
