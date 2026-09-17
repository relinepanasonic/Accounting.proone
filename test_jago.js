const fs = require('fs');
const pdf = require('pdf-parse');
const { parseJago } = require('./src/lib/reconciliation/parsers/jago.js');
const { parseBankDate, parseIndonesianNumber } = require('./src/lib/reconciliation/parsers/utils.js');

async function testPdf() {
  try {
    const pdfPath = 'C:/Users/nicoj/Desktop/jago_apr.pdf'; // wait, where is the pdf?
    // User hasn't uploaded the PDF files directly to the directory, they just showed screenshots.
  } catch(e) {}
}
testPdf();
