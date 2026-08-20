const flatLine = '13:27 DEWI PUSPITA SARI BNI 1788900858 Outgoing Transfer ID# 260126JAGBIDJA00122621 gaji dewi -4.510.000 5.192.930,32 PT Bank Jago Tbk is licensed and supervised by Financial Services Authority (OJK), Bank Indonesia, and also a member of Indonesia Deposit Insurance Corporation (LPS) deposit insurance program. www.jago.com Pockets Transactions History Page 2 of';
const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
const matches = flatLine.match(numRegex);
console.log(matches);
