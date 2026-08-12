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
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
      return NextResponse.json({ error: 'Invalid file format. Please upload a PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use unpdf for robust serverless extraction without worker/DOM errors
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
    const { text: rawText } = await extractText(pdfDoc, { mergePages: true });

    // Clean page break markers
    const cleanedText = rawText.replace(/[-]+Page\s*\(\d+\)\s*Break[-]+/g, '');

    // Split by newline, clean whitespace
    const rawLines = cleanedText.split('\n')
      .map((l: string) => l.replace(/\t/g, ' ').trim())
      .filter((l: string) => l.length > 0);

    let bankFormat = formData.get('bankFormat') as string || 'jago';
    
    // Auto-detect bank format based on PDF contents to prevent user error
    const fullText = rawLines.join(' ').toUpperCase();
    if (fullText.includes('REKENING GIRO') && fullText.includes('PERIODE') && fullText.includes('MUTASI SALDO')) {
      bankFormat = 'bca_business';
    } else if (fullText.includes('KANTOR CABANG') && fullText.includes('MUTASI') && !fullText.includes('REKENING GIRO')) {
      // Future-proofing for other formats, if needed
    }

    let transactions: any[] = [];

    if (bankFormat === 'bca_individual') {
      return NextResponse.json({ success: false, error: 'BCA Individual parsing is coming soon! Please provide a sample.' }, { status: 400 });
    }

    if (bankFormat === 'bca_business') {
      let year = new Date().getFullYear().toString();

      // Extract year from PERIODE header
      for (const line of rawLines) {
        const periodMatch = line.match(/PERIODE\s*[:\-]?\s*\S+\s+(\d{4})/i);
        if (periodMatch) { year = periodMatch[1]; break; }
        const dateRangeMatch = line.match(/\b(\d{4})\b/);
        if (dateRangeMatch && !line.match(/^(\d{2})\/(\d{2})/)) {
          year = dateRangeMatch[1]; break;
        }
      }

      const dateRegex = /^(\d{2})\/(\d{2})\s+(.*)/;
      const parsedBlocks: any[] = [];
      let currentTx: any = null;

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (
          line.includes('SALDO AWAL') || line.includes('SALDO AKHIR') ||
          line.includes('MUTASI CR') || line.includes('MUTASI DB')
        ) continue;

        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
          if (currentTx) parsedBlocks.push(currentTx);
          currentTx = {
            dateStr: `${year}-${dateMatch[2]}-${dateMatch[1]}`,
            rawLines: [dateMatch[3].trim()],
            id: `bca-${i}`,
          };
        } else if (currentTx) {
          currentTx.rawLines.push(line.trim());
        }
      }
      if (currentTx) parsedBlocks.push(currentTx);

      for (const tx of parsedBlocks) {
        let amount = 0;
        let isDebit = false;

        const twoNumbersRegex = /((?:\d{1,3}(?:,\d{3})+|\d{1,3})\.\d{2})\s*(DB)?\s+((?:\d{1,3}(?:,\d{3})+|\d{1,3})\.\d{2})\s*$/i;
        const oneNumberRegex = /((?:\d{1,3}(?:,\d{3})+|\d{1,3})\.\d{2})\s*(DB)?\s*$/i;

        for (let j = tx.rawLines.length - 1; j >= 0; j--) {
          const twoMatch = tx.rawLines[j].match(twoNumbersRegex);
          if (twoMatch) {
            amount = parseFloat(twoMatch[1].replace(/,/g, ''));
            if (twoMatch[2] && twoMatch[2].toUpperCase() === 'DB') isDebit = true;
            tx.rawLines[j] = tx.rawLines[j].replace(twoMatch[0], '').trim();
            break;
          }

          const oneMatch = tx.rawLines[j].match(oneNumberRegex);
          if (oneMatch) {
            amount = parseFloat(oneMatch[1].replace(/,/g, ''));
            if (oneMatch[2] && oneMatch[2].toUpperCase() === 'DB') isDebit = true;
            tx.rawLines[j] = tx.rawLines[j].replace(oneMatch[0], '').trim();
            break;
          }
        }

        if (amount > 0) {
          const finalAmount = isDebit ? -amount : amount;
          const desc = tx.rawLines
            .filter((l: string) => l.length > 0 && !l.match(/^(?:IDR|PERIODE|C A T A T A N)/))
            .join(' | ')
            .replace(/\|\s*$/, '')
            .replace(/^\|\s*/, '');
            
          transactions.push({
            id: `bca-${Date.now()}-${tx.id}-${Math.random().toString(36).substring(7)}`,
            date: tx.dateStr,
            amount: finalAmount,
            sourceDestination: desc,
            transactionDetails: '',
            notes: '',
            rekFrom: ''
          });
        }
      }
    } else {
      // Bank Jago logic
      const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})/;
      
      const parsedBlocks: any[] = [];
      let currentTx: any = null;

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const dateMatch = line.match(dateRegex);
        
        // Skip header lines that look like date ranges, e.g. "01 Jan 2026 - 31 Jan 2026"
        if (dateMatch && line.includes('-') && line.match(/\d{2}\s[A-Za-z]{3}\s\d{4}.*?-.*\d{2}\s[A-Za-z]{3}\s\d{4}/)) {
          continue;
        }

        if (dateMatch) {
          if (currentTx) parsedBlocks.push(currentTx);
          currentTx = {
            dateStr: dateMatch[1],
            rawLines: []
          };
          const rest = line.substring(dateMatch[0].length).trim();
          if (rest) currentTx.rawLines.push(rest);
        } else if (currentTx) {
          currentTx.rawLines.push(line);
        }
      }
      if (currentTx) parsedBlocks.push(currentTx);

      for (let i = 0; i < parsedBlocks.length; i++) {
        const tx = parsedBlocks[i];
        const flatLine = tx.rawLines.join(' ');
        
        // Match numbers formatted like 1.000.000,00 or -500.000
        const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
        const matches = flatLine.match(numRegex);
        
        if (!matches || matches.length < 2) continue;
        
        // Usually the second to last is amount, last is balance
        const amountStr = matches[matches.length - 2];
        const amount = parseIndonesianNumber(amountStr);
        if (isNaN(amount)) continue;
        
        const amtIndex = flatLine.lastIndexOf(amountStr);
        const bodyStr = flatLine.substring(0, amtIndex).trim();
        
        // The first part is usually time, e.g. "15.15" or "10.27"
        const timeRegex = /^\d{2}\.\d{2}\s/;
        const cleanBody = bodyStr.replace(timeRegex, '').trim();
        
        transactions.push({
          id: `jago-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
          date: parseBankDate(tx.dateStr),
          sourceDestination: cleanBody,
          transactionDetails: '',
          notes: '',
          rekFrom: '',
          amount,
        });
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transactions found. Please verify this is a valid statement PDF.\n\nFirst 30 lines:\n' + rawLines.slice(0, 30).join('\n'),
      });
    }

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
