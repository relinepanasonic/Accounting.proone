function parseIndonesianNumber(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d,\.-]/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts[1].length === 2) return parseFloat(cleaned.replace(',', '.'));
    return parseFloat(cleaned.replace(/,/g, ''));
  } else if (hasDot) {
    return parseFloat(cleaned.replace(/\./g, ''));
  }
  return parseFloat(cleaned);
}

function parseJago(rawLines) {
  const transactions = [];
  const dateRegex = /^(\d{2}\s[A-Za-z]{3}\s\d{4})/;
  
  const parsedBlocks = [];
  let currentTx = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    const dateMatch = line.match(dateRegex);
    
    if (dateMatch && line.includes('-') && line.match(/\d{2}\s[A-Za-z]{3}\s\d{4}.*?-.*\d{2}\s[A-Za-z]{3}\s\d{4}/)) {
      continue;
    }

    if (dateMatch) {
      if (currentTx) parsedBlocks.push(currentTx);
      currentTx = { dateStr: dateMatch[1], rawLines: [] };
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
    console.log("Processing block:", flatLine);
    
    const numRegex = /([-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
    const matches = flatLine.match(numRegex);
    
    if (!matches || matches.length < 2) {
      console.log("No numbers matched");
      continue;
    }
    console.log("Matches:", matches);
    
    const amountStr = matches[matches.length - 2];
    const amount = parseIndonesianNumber(amountStr);
    
    transactions.push({ amountStr, amount });
  }
  return transactions;
}

const rawText = `01 Apr 2026
10:50
ERIC SETIAWAN
Mandiri 1210005860600
Incoming Transfer
ID# 260401-YTKT-JECEVU
Lainnya
+13.600.000,00 20.292.448,34`;

console.log(parseJago(rawText.split('\n')));
