import { BankTransaction } from './types';
import { parseBankDate, parseIndonesianNumber } from './utils';

/**
 * Jago "Pockets Transactions History" PDF. Every transaction is a block of lines:
 *   04 Jan 2026            <- date
 *   15.15                  <- time
 *   Hostinger              <- who (may wrap over several lines)
 *   XENDIT                 <- bank / wallet
 *   9360084800000000050    <- account number
 *   Pembayaran QRIS        <- type
 *   ID# 2910561376         <- reference
 *   domain                 <- notes (may wrap)
 *   profesoronline.id -234.099 16.131.570,19     <- notes + amount + balance
 * Returns an empty list when the file is not in this layout, so the caller can try the older reader.
 */
const DATE_LINE = /^\d{1,2}\s+[A-Za-z]{3,4}\s+\d{4}$/;
const TIME_LINE = /^\d{2}\.\d{2}$/;
const AMOUNT_TAIL = /([-+]\s?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const ID_LINE = /^ID#\s*(.+)$/i;
const FOOTER = /^(PT Bank Jago Tbk|merupakan peserta penjaminan|Pockets Transactions History|Tanggal & Waktu|Info Penting)/i;
const MONTH_HEADER = /^[A-Za-z]+\s+\d{4}$/; // "Januari 2026"
const BANKS = /^(BCA Digital|BCA|BRI|BNI|BTN|Bank Mandiri|Mandiri|CIMB Niaga|CIMB|Permata|Danamon|BSI|XENDIT|FINPAY|ShopeePay|GoPay|OVO|DANA|LinkAja|PLN|Jago|Bank Jago|Blu|SeaBank|Allo Bank)\b/i;
const LONG_DIGITS = /\d{6,}/;

export function parseJagoPockets(rawLines: string[]): BankTransaction[] {
  const out: BankTransaction[] = [];
  // Cut the trailing legal text and page furniture, then walk the date + time blocks.
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  const starts: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) if (DATE_LINE.test(lines[i]) && TIME_LINE.test(lines[i + 1])) starts.push(i);

  for (let b = 0; b < starts.length; b++) {
    const from = starts[b];
    const to = b + 1 < starts.length ? starts[b + 1] : lines.length;
    const block: string[] = [];
    for (let i = from + 2; i < to; i++) {
      if (/^Info Penting/i.test(lines[i])) break;
      if (FOOTER.test(lines[i]) || /^merupakan peserta/i.test(lines[i]) || MONTH_HEADER.test(lines[i])) continue;
      block.push(lines[i]);
    }

    const idIdx = block.findIndex((l) => ID_LINE.test(l));
    const amountIdx = block.findIndex((l, i) => i >= Math.max(idIdx, 0) && AMOUNT_TAIL.test(l));
    if (idIdx < 1 || amountIdx < 0) continue;

    const m = block[amountIdx].match(AMOUNT_TAIL)!;
    const amount = parseIndonesianNumber(m[1].replace(/\s/g, '').replace(/^\+/, ''));
    if (Number.isNaN(amount)) continue;

    const type = block[idIdx - 1];
    const who = block.slice(0, idIdx - 1);
    // The account number line closes the "who" part: the bank name sits on it or on the line before.
    let acctIdx = who.findIndex((l) => LONG_DIGITS.test(l));
    if (acctIdx < 0) acctIdx = who.length - 1;
    const rekParts: string[] = [];
    if (acctIdx >= 0) rekParts.unshift(who[acctIdx]);
    let nameEnd = acctIdx;
    if (acctIdx > 0 && !BANKS.test(who[acctIdx]) && BANKS.test(who[acctIdx - 1])) { rekParts.unshift(who[acctIdx - 1]); nameEnd = acctIdx - 1; }
    const name = (nameEnd > 0 ? who.slice(0, nameEnd) : who.slice(0, 1)).join(' ').trim();

    const noteLines = [...block.slice(idIdx + 1, amountIdx), block[amountIdx].slice(0, block[amountIdx].length - m[0].length).trim()];
    const notes = noteLines.map((l) => l.trim()).filter((l) => l && l !== '-').join(' ');

    out.push({
      id: `jago-${from}-${b}`,
      date: parseBankDate(lines[from]),
      sourceDestination: name || type,
      transactionDetails: type,
      notes,
      rekFrom: rekParts.join(' ').trim(),
      amount,
    });
  }
  return out;
}
