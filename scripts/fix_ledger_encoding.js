const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/app/ledger/page.tsx');
let code = fs.readFileSync(p, 'utf8');
// It might be parsed incorrectly. Let's read as buffer and convert using iconv or just read raw and clean.
const buf = fs.readFileSync(p);
// Find if there are any non utf8 bytes.
// Or just let's rewrite it from scratch using my previous script.
