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
    const pdf = require('pdf-parse');

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
      return NextResponse.json({ error: 'Invalid file format. Please upload a PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await pdf(buffer);
    const rawText = data.text;

    // Clean page break markers
    const cleanedText = rawText.replace(/[-]+Page\s*\(\d+\)\s*Break[-]+/g, '');

    // Split by newline, clean whitespace
    const rawLines = cleanedText.split('\n')
      .map((l: string) => l.replace(/\t/g, ' ').trim())
      .filter((l: string) => l.length > 0);

    const bankFormat = formData.get('bankFormat') as string || 'jago';
    let transactions: any[] = [];

    if (bankFormat === 'bca_individual') {
      return NextResponse.json({ success: false, error: 'BCA Individual parsing is coming soon! Please provide a sample.' }, { status: 400 });
    }

    if (bankFormat === 'bca_business') {
      let year = new Date().getFullYear().toString();
      
      for (const line of rawLines) {
        if (line.toUpperCase().includes('PERIODE') && line.includes(':')) {
           const parts = line.split(':');
           if (parts.length > 1) {
             const periodeStr = parts[1].trim().toLowerCase(); 
             const pParts = periodeStr.split(/\s+/);
             if (pParts.length >= 2) {
               year = pParts[1];
             }
           }
           break;
        }
      }

      const dateRegex = /^(\d{2})\/(\d{2})\s+(.*)/;
      const parsedBlocks: any[] = [];
      let currentTx: any = null;

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (line.includes('SALDO AWAL') || line.includes('SALDO AKHIR') || line.includes('MUTASI CR') || line.includes('MUTASI DB')) continue;

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
        
        const mutasiRegex = /([\d]{1,3}(?:,[\d]{3})*\.\d{2})\s*(DB)?(?:\s+([\d]{1,3}(?:,[\d]{3})*\.\d{2}))?\s*$/i;
        
        for (let j = tx.rawLines.length - 1; j >= 0; j--) {
          const match = tx.rawLines[j].match(mutasiRegex);
          if (match) {
            const amtStr = match[1].replace(/,/g, '');
            amount = parseFloat(amtStr);
            if (match[2] && match[2].toUpperCase() === 'DB') isDebit = true;
            tx.rawLines[j] = tx.rawLines[j].replace(match[0], '').trim();
            break;
          }
        }
        
        if (amount > 0) {
          const finalAmount = isDebit ? -amount : amount;
          const desc = tx.rawLines.filter((l: string) => l.length > 0).join(' | ');
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
      // Bank Jago (Original Logic)
      const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})\s+(.*)/;
      const timeIdRegex = /^\d{2}:\d{2}\s/;

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const dateMatch = line.match(dateRegex);

        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        const rest = dateMatch[2];

        let sourceBankInfo = '';
        if (i + 1 < rawLines.length && timeIdRegex.test(rawLines[i + 1])) {
          sourceBankInfo = rawLines[i + 1];
        }

        const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
        const matches = rest.match(numRegex);

        if (!matches || matches.length < 2) continue;

        const amountStr = matches[matches.length - 2];
        const amount = parseIndonesianNumber(amountStr);

        if (isNaN(amount)) continue;

        const amtIndex = rest.lastIndexOf(amountStr);
        const bodyStr = rest.substring(0, amtIndex).trim();

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
