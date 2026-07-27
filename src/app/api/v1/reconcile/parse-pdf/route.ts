import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const PDFParser = require('pdf2json');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid file format. Please upload a PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text using pdf2json in JSON mode (preserves X/Y coordinates)
    const pdfData: any = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(); // No arguments = JSON mode
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)));
      pdfParser.on("pdfParser_dataReady", (data: any) => {
        resolve(data);
      });
      pdfParser.parseBuffer(buffer);
    });

    const transactions: any[] = [];
    const allLines: string[] = [];

    // Reconstruct visual lines by grouping text elements by Y coordinate
    for (const page of pdfData.formImage.Pages) {
      const yGroups: Record<number, { x: number; text: string }[]> = {};
      
      for (const item of page.Texts) {
        const textStr = decodeURIComponent(item.R[0].T);
        const y = Math.round(item.y * 2) / 2; // Group by nearest 0.5 to handle slight baseline shifts
        if (!yGroups[y]) yGroups[y] = [];
        yGroups[y].push({ x: item.x, text: textStr });
      }

      const sortedY = Object.keys(yGroups).map(Number).sort((a, b) => a - b);
      for (const y of sortedY) {
        // Sort items left-to-right
        const items = yGroups[y].sort((a, b) => a.x - b.x);
        // Join with a special separator to make parsing easy, or just spaces
        const lineText = items.map(i => i.text).join('   '); 
        allLines.push(lineText);
      }
    }

    const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})/; // Starts with Date, e.g. "06 Jan 2026"

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      if (dateRegex.test(line)) {
        // We found a main transaction line!
        // Visual Example: "26 Jan 2026   DEWI PUSPITA SARI   Outgoing Transfer   gaji dewi   -4.510.000   5.192.930,32"
        // Sometimes notes are missing: "13 Jan 2026   Kopi Kenangan   QRIS Payment   -59.000   15.059.930,32"
        
        const dateMatch = line.match(dateRegex);
        if (!dateMatch) continue;
        const dateStr = dateMatch[1];

        // The next line in the PDF usually contains the Time, Bank, and ID
        // Example: "13:27   BNI 1788900858   ID# 260126JAGBIDJA00122621"
        let nextLine = '';
        if (i + 1 < allLines.length && !dateRegex.test(allLines[i+1])) {
          nextLine = allLines[i+1];
        }

        // Extract Amount and Balance from the end of the main line
        const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
        const matches = line.match(numRegex);
        
        if (matches && matches.length >= 2) {
          const amountStr = matches[matches.length - 2];
          const cleanAmountStr = amountStr.replace(/\./g, '').replace(/,/g, '.');
          const amount = parseFloat(cleanAmountStr);

          // Everything between Date and Amount is the Description/Notes
          const bodyStr = line.substring(dateStr.length, line.lastIndexOf(amountStr)).trim();
          
          // Let's break the bodyStr into pieces using our '   ' separator
          const parts = bodyStr.split('   ').map(p => p.trim()).filter(p => p.length > 0);
          
          let sourceDest = parts[0] || 'Unknown';
          let remarks = parts.length > 1 ? parts.slice(1).join(' ') : '';
          
          // If the next line has bank details (e.g. BNI 1788900858), append it to sourceDest
          // The next line parts
          const nextParts = nextLine.split('   ').map(p => p.trim()).filter(p => p.length > 0);
          if (nextParts.length >= 2) {
            // nextParts[0] is usually time (13:27)
            // nextParts[1] is usually Bank (BNI 1788900858)
            if (!nextParts[1].includes('ID#')) {
              sourceDest += ` - ${nextParts[1]}`;
            }
          }

          transactions.push({
            id: `jago-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            date: dateStr,
            description: `${sourceDest} | ${remarks || 'No notes'}`,
            amount: amount
          });
        }
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No transactions found. Raw extraction snippet for debugging: \n' + allLines.slice(0, 20).join('\n')
      });
    }

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
