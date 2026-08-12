import { NextResponse } from 'next/server';
import { parseBCABusiness, parseJago, ParseResult } from '@/lib/reconciliation/parsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    let parseResult: ParseResult = { success: false, error: 'Unknown bank format.' };

    if (bankFormat === 'bca_individual') {
      return NextResponse.json({ success: false, error: 'BCA Individual parsing is coming soon! Please provide a sample.' }, { status: 400 });
    } else if (bankFormat === 'bca_business') {
      parseResult = parseBCABusiness(rawLines);
    } else {
      parseResult = parseJago(rawLines);
    }

    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error }, { status: 400 });
    }

    const transactions = parseResult.data || [];

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
