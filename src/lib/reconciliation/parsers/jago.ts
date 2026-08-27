import { BankTransaction, ParseResult } from './types';
import { parseBankDate, parseIndonesianNumber } from './utils';

export function parseJago(rawLines: string[]): ParseResult {
  const transactions: BankTransaction[] = [];
  const dateRegex = /(?:^|\s)(\d{2}\s+[A-Za-z]{3}\s+\d{4})/
  
  const parsedBlocks: any[] = [];
  let currentTx: any = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
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
      const matchIdx = line.indexOf(dateMatch[1]);
      const rest = line.substring(matchIdx + dateMatch[1].length).trim();
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

  return { success: true, data: transactions };
}



