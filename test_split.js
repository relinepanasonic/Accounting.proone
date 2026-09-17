const str = "Bank Match - Invoice INV-2026-965 | BANK-REF:2026-06-04:10000000:19:44 NICO WINARTA JAPAR BCA 3882171717 Incoming Transfer ID# 260604-PFVU-JKJPAQ Panasonic PRJ";
const ref = str.split(' | ')[1];
console.log(ref);
