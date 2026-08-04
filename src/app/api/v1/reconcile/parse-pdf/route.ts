import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Parse an Indonesian-format number string like "1.311.000" or "-1.311.000" or "16.338.930,32"
function parseIndonesianNumber(s: string): number {
  if (!s) return NaN;
  // Remove dots used as thousand separators, replace comma decimal separator with dot
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

// Convert "06 Jan 2026" to "2026-01-06"
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

export async function POST(request: Request) {
  try {
    // Use unpdf for serverless-safe PDF parsing
    const { extractText, getDocumentProxy } = await import('unpdf');

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
      return NextResponse.json({ error: 'Invalid file format. Please upload a PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const pdf = await getDocumentProxy(buffer);
    const data = await extractText(pdf, { mergePages: true });
    const rawText = (typeof data === 'string' ? data : data.text) || '';

    // Split into lines, clean whitespace
    const rawLines = rawText
      .split('\n')
      .map((l: string) => l.replace(/\t/g, ' ').trim())
      .filter((l: string) => l.length > 0);

    // Bank Jago transaction lines start with "DD Mon YYYY"
    const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})\s+(.*)/;
    const timeIdRegex = /^\d{2}:\d{2}\s/;
    const transactions: any[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const dateMatch = line.match(dateRegex);

      if (!dateMatch) continue;

      const dateStr = dateMatch[1];
      const rest = dateMatch[2];

      // Look for next line to get time/ref info
      let sourceBankInfo = '';
      if (i + 1 < rawLines.length && timeIdRegex.test(rawLines[i + 1])) {
        sourceBankInfo = rawLines[i + 1];
      }

      // Find all Indonesian-format numbers at end of line
      // Format: -1.311.000 or 16.338.930,32
      const numRegex = /(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
      const allMatches = rest.match(numRegex) || [];

      if (allMatches.length < 2) continue;

      // Last number = Balance, second-to-last = Amount
      const amountStr = allMatches[allMatches.length - 2];
      const amount = parseIndonesianNumber(amountStr);

      if (isNaN(amount)) continue;

      // Extract body before amounts
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
        date: parseBankDate(dateStr),
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
        error: `No transactions found. First 20 lines detected:\n${rawLines.slice(0, 20).join('\n')}`,
      });
    }

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown error parsing PDF' }, { status: 500 });
  }
}
