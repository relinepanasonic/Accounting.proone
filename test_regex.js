const str = "Bank Match - Invoice INV-123 | BANK-REF:2026-06-04:10000000:NICO WINARTA JAPAR BCA 3882171717 Incoming Transfer ID# 260604-PFVU-JKJPAQ Panasonic PRJ";
const match = str.match(/(BANK-REF:[^\s]+)/);
console.log("Regex match:", match ? match[1] : null);

const str2 = "Bank Match - Invoice INV-123 | BANK-REF:2026-06-04:10000000:NICO WINARTA JAPAR";
const match2 = str2.match(/BANK-REF:.*?((?=\s\|$)|$)/);
// Wait, if it's the rest of the string?
const match3 = str2.substring(str2.indexOf("BANK-REF:"));
console.log("Substring match:", match3);
