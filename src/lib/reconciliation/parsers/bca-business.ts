import { BankTransaction, ParseResult } from './types';

export function parseBCABusiness(rawLines: string[]): ParseResult {
  const transactions: BankTransaction[] = [];
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

  return { success: true, data: transactions };
}
