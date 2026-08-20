const text = '...some text... PT Bank Jago Tbk is licensed and supervised by Financial Services Authority (OJK), Bank Indonesia, and also a member of Indonesia Deposit Insurance Corporation (LPS) deposit insurance program. www.jago.com Pockets Transactions History Page 2 of 5 ...some other text...';
const cleaned = text.replace(/PT Bank Jago Tbk is licensed[\s\S]*?Page \d+\s*of\s*\d+/gi, '');
console.log(cleaned);
