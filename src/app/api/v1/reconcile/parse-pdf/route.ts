import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Ensure this runs in standard Node, not Edge
export const dynamic = 'force-dynamic'; // Prevent Next.js from statically rendering and crashing on canvas DOMMatrix

export async function POST(request: Request) {
  try {
    // Dynamically import to avoid Next.js build-time DOM/Canvas polyfill issues
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule as any).default || pdfModule;
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid file format. Please upload a PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF text
    const data = await pdfParse(buffer);
    const text = data.text;

    // Bank Jago Extraction Logic
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const transactions = [];

    const dateRegex = /^\d{2}\s[A-Za-z]{3}\s\d{4}$/; // e.g. "06 Jan 2026"
    const chunks = [];
    let currentChunk: string[] = [];

    for (const line of lines) {
      if (dateRegex.test(line)) {
        if (currentChunk.length > 0) chunks.push(currentChunk);
        currentChunk = [line];
      } else if (currentChunk.length > 0) {
        currentChunk.push(line);
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      if (chunk.length < 3) continue;

      const dateStr = chunk[0];
      // Time is usually chunk[1]
      // Source/Destination is usually chunk[2]
      let sourceDest = chunk[2];
      
      // Some bank details might be in chunk[3] if it doesn't say "Transfer"
      if (chunk.length >= 4 && !chunk[3].includes("Transfer") && !chunk[3].includes("ID#") && !chunk[3].includes("Payment")) {
        sourceDest += ` - ${chunk[3]}`;
      }

      const lastLine = chunk[chunk.length - 1];

      // Regex for Indonesian number format: Amount Balance
      const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
      const matches = lastLine.match(numRegex);

      if (matches && matches.length >= 2) {
        const amountStr = matches[matches.length - 2];
        const notesStr = lastLine.substring(0, lastLine.lastIndexOf(amountStr)).trim();

        const cleanAmountStr = amountStr.replace(/\./g, '').replace(/,/g, '.');
        const amount = parseFloat(cleanAmountStr);

        let remarks = notesStr;
        if (!remarks) {
          const types = ["Outgoing Transfer", "Incoming Transfer", "QRIS Payment", "Interest", "Tax on Interest"];
          for (const t of types) {
            if (chunk.find((c: string) => c.includes(t))) {
              remarks = t;
              break;
            }
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

    if (transactions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No transactions found. Raw extraction snippet for debugging: ' + text.substring(0, 500) 
      });
    }

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
