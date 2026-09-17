const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
let flatLine = "Mekari Pay XENDIT 9360084800000039819 Pembayaran QRIS ID# 2955537015 payment Katalis - PANASONIC - one stop -4.028.000 8.496.655,19 PT Bank Jago Tbk berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) dan Bank Indonesia, serta merupakan peserta penjaminan Lembaga Penjamin Simpanan (LPS). www.jago.com Pockets Transactions History Halaman 2 dari 4";

const footerIndex = flatLine.indexOf('PT Bank Jago Tbk');
if (footerIndex !== -1) {
  flatLine = flatLine.substring(0, footerIndex).trim();
}

console.log(flatLine);
const matches = flatLine.match(numRegex);
console.log(matches);
const amountStr = matches[matches.length - 2];
console.log(amountStr);
