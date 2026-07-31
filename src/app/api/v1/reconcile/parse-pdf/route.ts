import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const PDFParser = require('pdf2json');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
      return NextResponse.json({ error: 'Invalid file format. Please upload a PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf2json's raw text mode (2nd arg = 1 enables raw text extraction)
    const rawText: string = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)));
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });
      pdfParser.parseBuffer(buffer);
    });

    // getRawTextContent uses \t as column separator and \n as line separator
    // Page breaks look like: "----------------Page (1) Break----------------"
    // Clean the text: remove page-break markers, split into lines
    const cleanedText = rawText.replace(/[-]+Page\s*\(\d+\)\s*Break[-]+/g, '');
    
    // Split by newline, clean whitespace
    const rawLines = cleanedText.split('\n')
      .map((l: string) => l.replace(/\t/g, ' ').trim())
      .filter((l: string) => l.length > 0);

    // Bank Jago transaction lines look like:
    // "06 Jan 2026 09:27  NICO WINARTA JAPAR  Outgoing Transfer  Beli kulkas gading  -1.311.000  16.338.930,32"
    // But each visual row in the PDF is grouped across multiple rawLines because:
    // Row 1: Date + Source/Destination + Amount + Balance
    // Row 2: Time + BankCode + TransactionID
    // We need to find lines starting with a date pattern

    const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})\s+(.*)/;
    const timeIdRegex = /^\d{2}:\d{2}\s/;
    const transactions: any[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const dateMatch = line.match(dateRegex);
      
      if (!dateMatch) continue;

      const dateStr = dateMatch[1];   // e.g. "06 Jan 2026"
      const rest = dateMatch[2];      // everything after the date

      // rest looks like: "NICO WINARTA JAPAR  Outgoing Transfer  Beli kulkas gading  -1.311.000  16.338.930,32"
      // Find the next line — should be time + bank reference
      let sourceBankInfo = '';
      if (i + 1 < rawLines.length && timeIdRegex.test(rawLines[i + 1])) {
        sourceBankInfo = rawLines[i + 1];
      }

      // Extract all Indonesian-format numbers from end of line
      // Number format: -1.311.000 or 16.338.930,32
      const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
      const matches = rest.match(numRegex);

      if (!matches || matches.length < 2) continue;

      // Last number = Balance, second-to-last = Amount
      const amountStr = matches[matches.length - 2];
      const cleanAmt = amountStr.replace(/\./g, '').replace(/,/g, '.');
      const amount = parseFloat(cleanAmt);

      if (isNaN(amount)) continue;

      // Body is everything before the amount+balance at end
      const amtIndex = rest.lastIndexOf(amountStr);
      const bodyStr = rest.substring(0, amtIndex).trim();

      // bodyStr: "NICO WINARTA JAPAR  Outgoing Transfer  Beli kulkas gading"
      // Split body by 2+ spaces to get columns
      const parts = bodyStr.split(/\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
      
      let sourceDestination = parts[0] || 'Unknown';
      let transactionDetails = parts[1] || '';
      let notes = parts.length > 2 ? parts.slice(2).join(' ') : '';
      
      let rekFrom = '';
      const bankParts = sourceBankInfo.split(/\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
      if (bankParts.length >= 2 && !bankParts[1].startsWith('ID#')) {
        rekFrom = bankParts[1];
      }

      transactions.push({
        id: `jago-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        date: dateStr,
        sourceDestination,
        transactionDetails,
        notes,
        rekFrom,
        amount: amount,
      });
    }

    if (transactions.length === 0) {
      // Return first 30 lines of cleaned text for debugging
      return NextResponse.json({ 
        success: false, 
        error: 'No transactions found. Cleaned lines:\n' + rawLines.slice(0, 30).join('\n')
      });
    }

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
