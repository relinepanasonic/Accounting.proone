import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Convert "06 Jan 2026" → "2026-01-06"
function parseBankDate(dateStr: string): string {
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    mei: '05', may: '05', jun: '06', jul: '07',
    agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
    nov: '11', des: '12', dec: '12',
  };
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length !== 3) return dateStr;
  const day = parts[0].padStart(2, '0');
  const monthKey = parts[1].toLowerCase().substring(0, 3);
  const month = monthMap[monthKey] || '01';
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

// Parse Indonesian number format "1.311.000" or "-1.311.000" or "16.338.930,32"
function parseIndonesianNumber(s: string): number {
  if (!s) return NaN;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

export async function POST(request: Request) {
  try {
    // Use require() inside function body so it stays as a server-only dynamic require
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

    // Clean page break markers
    const cleanedText = rawText.replace(/[-]+Page\s*\(\d+\)\s*Break[-]+/g, '');

    // Split by newline, clean whitespace
    const rawLines = cleanedText.split('\n')
      .map((l: string) => l.replace(/\t/g, ' ').trim())
      .filter((l: string) => l.length > 0);

    // Bank Jago transaction lines start with "DD Mon YYYY"
    // e.g. "06 Jan 2026  NICO WINARTA JAPAR  Outgoing Transfer  Beli kulkas gading  -1.311.000  16.338.930,32"
    const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})\s+(.*)/;
    const timeIdRegex = /^\d{2}:\d{2}\s/;
    const transactions: any[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const dateMatch = line.match(dateRegex);

      if (!dateMatch) continue;

      const dateStr = dateMatch[1];   // e.g. "06 Jan 2026"
      const rest = dateMatch[2];      // everything after the date

      // Next line is usually: time + bank reference code
      let sourceBankInfo = '';
      if (i + 1 < rawLines.length && timeIdRegex.test(rawLines[i + 1])) {
        sourceBankInfo = rawLines[i + 1];
      }

      // Extract all Indonesian-format numbers from end of line
      const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
      const matches = rest.match(numRegex);

      if (!matches || matches.length < 2) continue;

      // Last number = Balance, second-to-last = Amount
      const amountStr = matches[matches.length - 2];
      const amount = parseIndonesianNumber(amountStr);

      if (isNaN(amount)) continue;

      // Body is everything before the amount+balance at end
      const amtIndex = rest.lastIndexOf(amountStr);
      const bodyStr = rest.substring(0, amtIndex).trim();

      // Split body by 2+ spaces to get columns
      const parts = bodyStr.split(/\s{2,}/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);

      const sourceDestination = parts[0] || 'Unknown';
      const transactionDetails = parts[1] || '';
      const notes = parts.length > 2 ? parts.slice(2).join(' ') : '';

      let rekFrom = '';
      const bankParts = sourceBankInfo.split(/\s{2,}/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      if (bankParts.length >= 2 && !bankParts[1].startsWith('ID#')) {
        rekFrom = bankParts[1];
      }

      transactions.push({
        id: `jago-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
        date: parseBankDate(dateStr),  // Convert to YYYY-MM-DD
        sourceDestination,
        transactionDetails,
        notes,
        rekFrom,
        amount,
      });
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transactions found. First 30 lines:\n' + rawLines.slice(0, 30).join('\n'),
      });
    }

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
