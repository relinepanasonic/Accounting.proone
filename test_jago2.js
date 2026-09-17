const { parseJago } = require('./src/lib/reconciliation/parsers/jago.js');
const rawText = `PT Bank Jago Tbk is licensed and supervised by Financial Services Authority (OJK), Bank Indonesia, and
also a member of Indonesia Deposit Insurance Corporation (LPS) deposit insurance program.
www.jago.com
Pockets Transactions History Page 1 of 4
NICO WINARTA JAPAR
New Wave Jakarta 102900358121
Showing IDR transaction from Latest Balance per 24 Aug 2026
01 Apr 2026 - 30 Apr 2026 IDR 139.840,46
Date & Time Source/Destination Transaction Details Notes Amount Balance
April 2026
01 Apr 2026
10:50
ERIC SETIAWAN
Mandiri 1210005860600
Incoming Transfer
ID# 260401-YTKT-JECEVU
Lainnya +13.600.000,00 20.292.448,34
02 Apr 2026
04:23
INDRI
BCA 6042395028
Outgoing Transfer
ID# 260402JAGBIDJA00017390
salary -1.000.000 19.292.448,34
02 Apr 2026
11:09
INDRI
BCA 6042395028
Outgoing Transfer
ID# 260402JAGBIDJA00090193
gaji maret Lunas -2.000.000 17.292.448,34`;

const rawLines = rawText.split('\n');
const res = parseJago(rawLines);
console.log("Parsed transactions:", res.data ? res.data.length : 0);
console.log(res.data);
