const fs = require('fs');
let content = fs.readFileSync('src/app/api/v1/reconcile/parse-pdf/route.ts', 'utf8');

const oldLogic = `      // Auto-detect bank format based on PDF contents to prevent user error
      const fullText = rawLines.join(' ').toUpperCase();
      if (fullText.includes('REKENING GIRO') && fullText.includes('PERIODE') && fullText.includes('MUTASI SALDO')) {
        bankFormat = 'bca_business';
      } else if (fullText.includes('KANTOR CABANG') && fullText.includes('MUTASI') && !fullText.includes('REKENING GIRO')) {
        // Future-proofing for other formats, if needed
      }`;

const newLogic = `      // Auto-detect bank format based on PDF contents to prevent user error
      const fullText = rawLines.join(' ').toUpperCase();
      if (fullText.includes('REKENING GIRO') && fullText.includes('PERIODE') && fullText.includes('MUTASI SALDO')) {
        bankFormat = 'bca_business';
      } else if (fullText.includes('BANK JAGO') || fullText.includes('POCKETS TRANSACTIONS HISTORY') || fullText.includes('JAGO.COM')) {
        bankFormat = 'jago';
      }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/app/api/v1/reconcile/parse-pdf/route.ts', content);
console.log("Done");
