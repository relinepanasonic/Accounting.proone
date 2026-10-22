'use client';
import { formatIndoDate } from '@/lib/utils';
import { DatePickerUI } from '@/components/ui/DatePickerUI';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Receipt,
  FileText,
  Banknote,
} from 'lucide-react';
import { reconcileRecord, quickResolveAndReconcile, unreconcileRecord } from '@/app/actions/reconcile';
import { createClientRecord } from '@/app/actions/settings';
import { recordInvoicePayment } from '@/app/actions/invoices';
import { relinkBankBook, releaseBankRef } from '@/app/actions/bank-book';
import { RupiahInput } from '@/components/ui/RupiahInput';

export interface UnreconciledSystemRecord {
  id: string;
  type: 'invoice' | 'expense' | 'payroll' | 'income';
  reference: string;
  payeeOrClient: string;
  date: string;
  amount: number;
  reconciled?: boolean;
  notes?: string;
}

interface BankLine {
  id: string;
  date: string;
  sourceDestination: string;
  transactionDetails: string;
  notes: string;
  rekFrom: string;
  amount: number;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder?: string;
}

interface COAAccountMinimal {
  account_code: string;
  account_name: string;
  account_type: string;
}

function payeeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  if (aL === bL) return 1;
  const wordsB = bL.split(/\s+/).filter((w) => w.length > 3);
  const matches = wordsB.filter((w) => aL.includes(w));
  return matches.length / Math.max(wordsB.length, 1);
}

// Local-time YYYY-MM-DD (toISOString would shift the day back in UTC+7); undefined if unparseable.
function toIsoDate(value: string): string | undefined {
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface BookLine { id: string; bankAccountId: string; date: string; counterparty: string; details: string; notes: string; rekFrom: string; amount: number }
export interface OpenInvoice { id: string; number: string; client: string; date: string; total: number; paid: number; balance: number }

interface ReconciliationHUDProps {
  systemRecords: UnreconciledSystemRecord[];
  bankAccounts?: BankAccount[];
  coaAccounts?: COAAccountMinimal[];
  reconciledBankRefs?: string[];
  vendors?: { id: string; name: string }[];
  /** Invoices that still have a balance (Invoice Unpaid). */
  openInvoices?: OpenInvoice[];
  /** The left side: the lines of Buku Bank that are not matched yet. */
  bookLines?: BookLine[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const rp = (n: number) => `Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${rp(n)}`;

/** One month filter per side: month (or all months) and year. */
function MonthFilter({ month, year, years, onChange }: { month: number; year: number; years: number[]; onChange: (month: number, year: number) => void }) {
  const cls = 'rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-zinc-200 outline-none focus:border-[#d4af37]/60';
  return (
    <div className="flex items-center gap-1.5">
      <select value={year} onChange={(e) => onChange(month, Number(e.target.value))} className={cls} aria-label="Year">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={month} onChange={(e) => onChange(Number(e.target.value), year)} className={cls} aria-label="Month">
        <option value={0}>All months</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
    </div>
  );
}

/** A segmented toggle (All | In | Out ...). */
function Segment<T extends string>({ value, options, onChange }: { value: T; options: Array<{ key: T; label: string; tone?: 'gold' | 'green' | 'red' | 'blue' }>; onChange: (v: T) => void }) {
  const tone = { gold: 'bg-[#d4af37]/20 text-[#f5d77f]', green: 'bg-emerald-500/20 text-emerald-400', red: 'bg-red-500/20 text-red-400', blue: 'bg-sky-500/20 text-sky-300' };
  return (
    <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${value === o.key ? tone[o.tone || 'gold'] : 'text-zinc-500 hover:text-zinc-300'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function ReconciliationHUD({ systemRecords, bankAccounts = [], coaAccounts = [], reconciledBankRefs = [], vendors = [], openInvoices = [], bookLines = [] }: ReconciliationHUDProps) {
  const router = useRouter();
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [recordsList, setRecordsList] = useState<UnreconciledSystemRecord[]>(systemRecords);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Right side: Cash Received | Invoice Unpaid | Expenses | Matched
  const [rightTab, setRightTab] = useState<'cash' | 'unpaid' | 'expenses' | 'matched'>('cash');
  const [dirFilter, setDirFilter] = useState<'all' | 'in' | 'out'>('all');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [paySearch, setPaySearch] = useState('');
  const [payPartial, setPayPartial] = useState<Record<string, number | ''>>({});
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // "No match?" on a bank card: create the missing record (expense, direct income or an invoice payment) in a window.
  const [noMatchMode, setNoMatchMode] = useState<'expense' | 'income' | 'invoice' | null>(null);
  const [quickCategory, setQuickCategory] = useState<string>('');
  const [quickVendorName, setQuickVendorName] = useState('');
  const [quickVendorId, setQuickVendorId] = useState<string | undefined>(undefined);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [isQuickAddingVendor, setIsQuickAddingVendor] = useState(false);
  const [localVendors, setLocalVendors] = useState(vendors);
  const [quickDate, setQuickDate] = useState('');
  const [quickAmount, setQuickAmount] = useState<number | ''>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [coaDropdownOpen, setCoaDropdownOpen] = useState(false);
  const [expandedCoaGroups, setExpandedCoaGroups] = useState<Record<string, boolean>>({});
  const showQuickForm = noMatchMode === 'expense' || noMatchMode === 'income';
  const setShowQuickForm = (open: boolean) => { if (!open) setNoMatchMode(null); };

  const [activeBankId, setActiveBankId] = useState<string>(bankAccounts.length > 0 ? bankAccounts[0].id : '');
  const activeBank = bankAccounts.find((b) => b.id === activeBankId);

  // One month filter per side (0 = all months).
  const now = new Date();
  const [bankMonth, setBankMonth] = useState<number>(now.getMonth() + 1);
  const [bankYear, setBankYear] = useState<number>(now.getFullYear());
  const [sysMonth, setSysMonth] = useState<number>(now.getMonth() + 1);
  const [sysYear, setSysYear] = useState<number>(now.getFullYear());
  const [reconciledRefs, setReconciledRefs] = useState<string[]>(reconciledBankRefs);
  const [optionsDialog, setOptionsDialog] = useState<{
    title: string;
    message: React.ReactNode;
    buttons: { text: string; value: string; isPrimary?: boolean; isDanger?: boolean }[];
    onSelect: (val: string | null) => void;
  } | null>(null);

  const askOptions = (title: string, message: React.ReactNode, buttons: { text: string; value: string; isPrimary?: boolean; isDanger?: boolean }[]): Promise<string | null> => {
    return new Promise((resolve) => {
      setOptionsDialog({
        title, message, buttons,
        onSelect: (val) => {
          setOptionsDialog(null);
          resolve(val);
        }
      });
    });
  };

  const activeBankLine = bankLines.find((b) => b.id === selectedBankId);

  useEffect(() => { setRecordsList(systemRecords); }, [systemRecords]);
  // Left side = Buku Bank: the open lines of the chosen bank account. Both sides open on the month of the first open line.
  const feedStarted = useRef(false);
  useEffect(() => {
    const feed: BankLine[] = bookLines
      .filter((l) => l.bankAccountId === activeBankId)
      .map((l) => ({ id: l.id, date: l.date, sourceDestination: l.counterparty, transactionDetails: l.details, notes: l.notes, rekFrom: l.rekFrom, amount: l.amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setBankLines(feed);
    if (!feedStarted.current && feed.length > 0) {
      feedStarted.current = true;
      const d = new Date(feed[0].date);
      if (!isNaN(d.getTime())) { setBankMonth(d.getMonth() + 1); setBankYear(d.getFullYear()); setSysMonth(d.getMonth() + 1); setSysYear(d.getFullYear()); }
    }
  }, [bookLines, activeBankId]);
  useEffect(() => {
    if (pendingSelect && recordsList.some((r) => r.id === pendingSelect)) { setSelectedRecordIds([pendingSelect]); setPendingSelect(null); }
  }, [pendingSelect, recordsList]);

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    for (const l of bookLines) ys.add(Number(l.date.slice(0, 4)));
    for (const r of recordsList) { const y = Number(String(r.date).slice(0, 4)); if (y > 2000) ys.add(y); }
    return Array.from(ys).filter((y) => y > 2000).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookLines, recordsList]);

  const inMonth = (date: string, month: number, year: number) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return d.getFullYear() === year && (month === 0 || d.getMonth() + 1 === month);
  };

  // Record the payment of an unpaid invoice (System side, Invoice Unpaid): it becomes a cash record to match.
  const payOneInvoice = (inv: OpenInvoice, amount: number) => {
    if (!(amount > 0)) { setPayError('Fill the amount of the payment.'); return; }
    if (amount > inv.balance + 0.5) { setPayError(`The payment is more than the balance of ${inv.number} (${rp(inv.balance)}).`); return; }
    setPayError('');
    setPayBusy(inv.id);
    const bankId = activeBank && !String(activeBank.id).startsWith('temp-') ? activeBank.id : undefined;
    void recordInvoicePayment(inv.id, amount, activeBankLine?.date || new Date().toISOString().slice(0, 10), 'Bank Transfer', activeBankLine ? `Bank ${activeBankLine.sourceDestination}`.slice(0, 80) : undefined, undefined, bankId).then((res: any) => {
      setPayBusy(null);
      if (!res?.success) { setPayError(res?.error || 'Could not record the payment.'); return; }
      setRightTab('cash');
      setPaySearch('');
      if (res.transactionId) setPendingSelect(res.transactionId);
      router.refresh();
    });
  };

  // "No match?" > invoice: the bank amount is the payment. It is recorded and matched with this bank line at once.
  const payInvoiceFromBankLine = (inv: OpenInvoice) => {
    if (!activeBankLine) return;
    const amount = Math.abs(activeBankLine.amount);
    if (amount > inv.balance + 0.5) { setPayError(`The bank amount (${rp(amount)}) is more than the balance of ${inv.number} (${rp(inv.balance)}).`); return; }
    setPayError('');
    setPayBusy(inv.id);
    const line = activeBankLine;
    const bankId = activeBank && !String(activeBank.id).startsWith('temp-') ? activeBank.id : undefined;
    const ref = `BANK-REF:${line.date}:${line.amount}:${line.sourceDestination}`;
    void (async () => {
      try {
        const res: any = await recordInvoicePayment(inv.id, amount, toIsoDate(line.date) || line.date, 'Bank Transfer', `Bank ${line.sourceDestination}`.slice(0, 80), undefined, bankId);
        if (!res?.success || !res.transactionId) { setPayError(res?.error || 'Could not record the payment.'); return; }
        await reconcileRecord(res.transactionId, 'income', ref, activeBankId, undefined, false, undefined, toIsoDate(line.date));
        setBankLines((prev) => prev.filter((b) => b.id !== line.id));
        setSelectedBankId(null);
        setNoMatchMode(null);
        void relinkBankBook().finally(() => router.refresh());
      } catch (err: any) {
        setPayError(err?.message || 'Could not record the payment.');
      } finally {
        setPayBusy(null);
      }
    })();
  };

  // One suggestion per bank line, and each system record is suggested at most once:
  // all same-amount pairs are scored, then assigned best score first.
  const suggestions = useMemo(() => {
    const pairs: { lineId: string; record: UnreconciledSystemRecord; score: number }[] = [];
    for (const bankLine of bankLines) {
      for (const r of recordsList) {
        if (r.reconciled) continue;
        const typeOk = (bankLine.amount > 0 && (r.type === 'invoice' || r.type === 'income')) ||
          (bankLine.amount < 0 && (r.type === 'expense' || r.type === 'payroll'));
        if (!typeOk || Math.abs(r.amount - Math.abs(bankLine.amount)) >= 0.01) continue;
        const pScore = payeeSimilarity(bankLine.sourceDestination, r.payeeOrClient || r.reference);
        // Payer name on the statement often differs from the client name, so date proximity
        // is what separates same-amount candidates.
        const dayGap = Math.abs(new Date(bankLine.date).getTime() - new Date(r.date).getTime()) / 86400000;
        const dateScore = Number.isNaN(dayGap) ? 0 : dayGap <= 7 ? 1 : dayGap <= 31 ? 0.5 : 0;
        pairs.push({ lineId: bankLine.id, record: r, score: 0.5 + pScore * 0.25 + dateScore * 0.25 });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    const byLine = new Map<string, UnreconciledSystemRecord>();
    const usedRecords = new Set<string>();
    for (const p of pairs) {
      if (byLine.has(p.lineId) || usedRecords.has(p.record.id)) continue;
      byLine.set(p.lineId, p.record);
      usedRecords.add(p.record.id);
    }
    return byLine;
  }, [bankLines, recordsList]);

  function findBestMatch(bankLine: BankLine): UnreconciledSystemRecord | null {
    return suggestions.get(bankLine.id) ?? null;
  }

  const bestMatchRecord = activeBankLine ? findBestMatch(activeBankLine) : null;
  // MATCH works on what you clicked: one bank card on the left and the card(s) on the right. A suggestion only shows a hint.
  const currentTargetRecordIds = selectedRecordIds;

  useEffect(() => {
    if (activeBankLine) {
      setQuickVendorName(activeBankLine.sourceDestination || '');
      setQuickVendorId(undefined);
      setQuickDate(activeBankLine.date || '');
      setQuickAmount(Math.abs(activeBankLine.amount || 0));
      setQuickNotes([activeBankLine.notes, activeBankLine.transactionDetails].filter(Boolean).join(' | '));
    }
  }, [activeBankLine]);

  const filteredBankLines = useMemo(() => {
    return bankLines.filter((b) => {
      if (!inMonth(b.date, bankMonth, bankYear)) return false;
      if (dirFilter === 'in' && !(b.amount > 0)) return false;
      if (dirFilter === 'out' && !(b.amount < 0)) return false;
      const bm = findBestMatch(b);
      if (activeFilterTab === 'matched') return !!bm;
      if (activeFilterTab === 'unmatched') return !bm;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankLines, bankMonth, bankYear, activeFilterTab, dirFilter, recordsList]);

  const handleMatchAndClear = async () => {
    const activeTargetIds = currentTargetRecordIds;
    if (!activeBankLine || activeTargetIds.length === 0) return;
    const targetRecords = recordsList.filter((r) => activeTargetIds.includes(r.id));
    if (targetRecords.length === 0) return;

    const bankAmountAbs = Math.abs(activeBankLine.amount);
    const recordAmountAbs = Math.abs(targetRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0));
    let shouldClearDiff = false;
    let isPartialPayment = false;
    let isTaxWriteoff = false;
    let multiAdjust: { recordId: string; newAmount: number } | null = null;

    if (targetRecords.length > 1 && bankAmountAbs !== recordAmountAbs) {
      // Several records paid with one transfer that does not add up exactly (usually a rounding difference).
      const diffSigned = bankAmountAbs - recordAmountAbs; // positive: the bank received more
      const last = targetRecords[targetRecords.length - 1];
      const newAmount = Math.abs(last.amount) + diffSigned;
      const lastName = last.payeeOrClient || last.reference;
      if (newAmount <= 0) {
        await askOptions('Cannot match', 'The difference is larger than the last selected record. Select the records again.', [{ text: 'Close', value: 'close', isPrimary: true }]);
        return;
      }
      const choice = await askOptions(
        'Amounts do not add up',
        <div className="space-y-1 text-sm">
          <p>Bank: <span className="text-[#f5d77f]">Rp {bankAmountAbs.toLocaleString('id-ID')}</span></p>
          <p>{targetRecords.length} records: <span className="text-white">Rp {recordAmountAbs.toLocaleString('id-ID')}</span></p>
          <p className="mt-2 text-zinc-300">Difference: <span className="font-bold text-white">Rp {Math.abs(diffSigned).toLocaleString('id-ID')}</span> ({diffSigned > 0 ? 'bank received more' : 'bank received less'})</p>
          <p className="mt-3 text-zinc-400">The difference is applied to "{lastName}", which becomes Rp {newAmount.toLocaleString('id-ID')}. All records are then matched.</p>
        </div>,
        [
          { text: `Apply Rp ${Math.abs(diffSigned).toLocaleString('id-ID')} and match`, value: 'adjust', isPrimary: true },
          { text: 'Cancel', value: 'cancel', isDanger: true }
        ]
      );
      if (choice !== 'adjust') return;
      multiAdjust = { recordId: last.id, newAmount };
    }

    if (bankAmountAbs !== recordAmountAbs && targetRecords.length === 1) {
      const diffAbs = recordAmountAbs - bankAmountAbs;

      if (bankAmountAbs < recordAmountAbs && targetRecords[0].type === 'invoice') {
        const choice = await askOptions(
          'Invoice Amount Mismatch',
          <div className="space-y-1 text-sm"><p>Bank: <span className="text-[#f5d77f]">Rp {bankAmountAbs.toLocaleString('id-ID')}</span></p><p>Invoice: <span className="text-white">Rp {recordAmountAbs.toLocaleString('id-ID')}</span></p><p className="mt-3 text-zinc-400">Difference: Rp {diffAbs.toLocaleString('id-ID')}</p></div>,
          [
            { text: 'Add Tax / Fee Write-off', value: 'writeoff', isPrimary: true },
            { text: 'Record as Partial Payment', value: 'partial' },
            { text: 'Shrink Invoice Total', value: 'shrink' },
            { text: 'Cancel', value: 'cancel', isDanger: true }
          ]
        );
        if (choice === 'cancel' || choice === null) return;
        if (choice === 'partial') isPartialPayment = true;
        if (choice === 'shrink') shouldClearDiff = true;
        if (choice === 'writeoff') isTaxWriteoff = true;
      } else {
        const proceed = await askOptions(
          'Amount Mismatch',
          <div className="space-y-1 text-sm"><p>Bank: <span className="text-[#f5d77f]">Rp {bankAmountAbs.toLocaleString('id-ID')}</span></p><p>System: <span className="text-white">Rp {recordAmountAbs.toLocaleString('id-ID')}</span></p><p className="mt-3 font-bold text-white">Adjust system to bank amount?</p></div>,
          [
            { text: 'Adjust System Amount', value: 'adjust', isPrimary: true },
            { text: 'Cancel', value: 'cancel', isDanger: true }
          ]
        );
        if (proceed !== 'adjust') return;
        shouldClearDiff = true;
      }
    }

    startTransition(async () => {
      try {
        const uniqueRef = `BANK-REF:${activeBankLine.date}:${activeBankLine.amount}:${activeBankLine.sourceDestination}`;
        const taxWriteoffAmount = isTaxWriteoff ? recordAmountAbs - bankAmountAbs : undefined;

        for (const targetRecord of targetRecords) {
          await reconcileRecord(
            targetRecord.id,
            targetRecord.type,
            uniqueRef,
            activeBankId,
            multiAdjust
              ? (targetRecord.id === multiAdjust.recordId ? multiAdjust.newAmount : undefined)
              : (shouldClearDiff || isPartialPayment || isTaxWriteoff) ? Math.abs(activeBankLine.amount) : undefined,
            isPartialPayment,
            taxWriteoffAmount,
            toIsoDate(activeBankLine.date)
          );
        }
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        void relinkBankBook().finally(() => router.refresh());
        if (isPartialPayment) {
          setRecordsList((prev) => prev.map((r) => activeTargetIds.includes(r.id) ? { ...r, amount: r.amount > 0 ? r.amount - bankAmountAbs : r.amount + bankAmountAbs } : r));
        } else {
          setRecordsList((prev) => prev.map((r) => (activeTargetIds.includes(r.id) ? { ...r, reconciled: true } : r)));
        }
        setSelectedRecordIds([]);
        setSelectedBankId(null);
      } catch (err) { console.error(err); }
    });
  };

  const handleUndoMatch = async (rec: UnreconciledSystemRecord) => {
    const name = rec.payeeOrClient || rec.reference;
    const choice = await askOptions(
      'Undo this match?',
      <div className="space-y-2 text-sm">
        <p>"{name}" will go back to <span className="text-white font-bold">not reconciled</span> and the ledger lines posted by the match are removed.</p>
        <p className="text-zinc-400">If one bank transfer was matched to several records, undo each of them. Amounts that were adjusted during the match are not restored.</p>
      </div>,
      [
        { text: 'Undo match', value: 'undo', isPrimary: true },
        { text: 'Keep it', value: 'cancel', isDanger: true }
      ]
    );
    if (choice !== 'undo') return;

    startTransition(async () => {
      try {
        const res = await unreconcileRecord(rec.id, rec.type);
        if (!res.success) {
          await askOptions('Could not undo', res.error || 'Something went wrong.', [{ text: 'Close', value: 'close', isPrimary: true }]);
          return;
        }
        setRecordsList((prev) => (res.deleted ? prev.filter((r) => r.id !== rec.id) : prev.map((r) => (r.id === rec.id ? { ...r, reconciled: false } : r))));

        // Put the bank line back in the feed so it can be matched again, correctly.
        const ref = res.bankReference;
        if (ref) {
          setReconciledRefs((prev) => prev.filter((r) => r !== ref));
          void releaseBankRef(ref).finally(() => router.refresh());
        }
        await askOptions('Match undone', ref ? 'The bank line is back in the feed on the left.' : 'The record is open again.', [{ text: 'Close', value: 'close', isPrimary: true }]);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleQuickResolve = (type: 'expense' | 'income') => {
    if (!activeBankLine) return;
    startTransition(async () => {
      try {
        const uniqueBankRef = `BANK-REF:${activeBankLine.date}:${activeBankLine.amount}:${activeBankLine.sourceDestination}`;
        const finalDescription = (quickVendorName ? quickVendorName + ' | ' : '') + quickNotes;
        await quickResolveAndReconcile(type, quickCategory, Number(quickAmount) || Math.abs(activeBankLine.amount), quickDate || activeBankLine.date, finalDescription || 'Quick Resolve', uniqueBankRef, activeBankId, quickVendorId);
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        void relinkBankBook().finally(() => router.refresh());
        setSelectedBankId(null);
        setQuickCategory(''); setQuickVendorName(''); setQuickVendorId(undefined); setQuickNotes(''); setShowQuickForm(false);
      } catch (err) { console.error(err); alert('Failed to save. Please try again.'); }
    });
  };

  const handleQuickAddVendor = async () => {
    if (!quickVendorName.trim()) return;
    setIsQuickAddingVendor(true);
    try {
      const res = await createClientRecord({ name: quickVendorName, contactType: 'vendor' });
      if (res.success && res.client) { setLocalVendors((prev) => [...prev, res.client!]); setQuickVendorId(res.client.id); setVendorDropdownOpen(false); }
      else alert(res.error || 'Failed to create vendor');
    } catch (err: any) { alert(err?.message || 'Error'); }
    finally { setIsQuickAddingVendor(false); }
  };

  const payShown = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    const line = activeBankLine && activeBankLine.amount > 0 ? activeBankLine : null;
    const score = (i: OpenInvoice) => (line ? (Math.abs(i.balance - line.amount) < 1 ? 2 : 0) + payeeSimilarity(line.sourceDestination, i.client) * 1.5 : 0);
    return openInvoices
      .filter((i) => !q || `${i.client} ${i.number}`.toLowerCase().includes(q))
      .sort((a, b) => score(b) - score(a) || b.date.localeCompare(a.date))
      .slice(0, 60);
  }, [openInvoices, paySearch, activeBankLine]);

  const filteredSystemRecords = useMemo(() => {
    let list = recordsList.filter((r) => {
      if (!inMonth(r.date, sysMonth, sysYear)) return false;
      if (rightTab === 'matched') return Boolean(r.reconciled);
      if (rightTab === 'expenses') return r.type === 'expense' || r.type === 'payroll';
      return r.type === 'income' || r.type === 'invoice';
    });
    if (rightTab !== 'matched' && activeBankLine) {
      const score = (r: UnreconciledSystemRecord) => (Math.abs(r.amount - Math.abs(activeBankLine.amount)) < 0.01 ? 1 : 0) + payeeSimilarity(activeBankLine.sourceDestination, r.payeeOrClient || r.reference);
      list = list.sort((a, b) => score(b) - score(a));
    } else {
      list = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return list.slice(0, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsList, rightTab, activeBankLine, sysMonth, sysYear]);

  // Counts for the tabs follow the month filter of the System side.
  const tabCounts = useMemo(() => {
    let cash = 0; let expenses = 0; let matched = 0;
    for (const r of recordsList) {
      if (!inMonth(r.date, sysMonth, sysYear)) continue;
      if (r.reconciled) matched++;
      if (r.type === 'expense' || r.type === 'payroll') expenses++;
      else cash++;
    }
    return { cash, expenses, matched, unpaid: openInvoices.length };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsList, sysMonth, sysYear, openInvoices]);

  const bankAmt = activeBankLine ? Math.abs(activeBankLine.amount) : 0;
  const selectedRecords = recordsList.filter((r) => currentTargetRecordIds.includes(r.id));
  const systemAmt = selectedRecords.reduce((s, r) => s + Math.abs(r.amount), 0);
  const diff = systemAmt - bankAmt;
  const isExactMatch = bankAmt > 0 && Math.abs(diff) < 0.01;
  // MATCH wakes up (gold) only with one card chosen on the left and at least one on the right.
  const canMatch = !!activeBankLine && selectedRecords.length > 0;

  const pickBankLine = (line: BankLine) => {
    if (selectedBankId === line.id) { setSelectedBankId(null); return; }
    setSelectedBankId(line.id);
    // The right side follows the direction of the bank card.
    if (line.amount > 0 && (rightTab === 'expenses')) setRightTab('cash');
    if (line.amount < 0 && (rightTab === 'cash' || rightTab === 'unpaid')) setRightTab('expenses');
    setSelectedRecordIds([]);
  };

  const openNoMatch = (line: BankLine, mode: 'expense' | 'income' | 'invoice') => {
    setSelectedBankId(line.id);
    setPayError('');
    setPaySearch('');
    setNoMatchMode(mode);
  };

  const label = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1';
  const field = 'w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]';
  const modalTitle = noMatchMode === 'expense' ? 'Create expense' : noMatchMode === 'income' ? 'Create direct income' : 'Record invoice payment';

  const tabs: Array<{ key: typeof rightTab; label: string; count: number; tone?: 'gold' | 'green' | 'red' | 'blue' }> = [
    { key: 'cash', label: 'Cash Received', count: tabCounts.cash, tone: 'gold' },
    { key: 'unpaid', label: 'Invoice Unpaid', count: tabCounts.unpaid, tone: 'blue' },
    { key: 'expenses', label: 'Expenses', count: tabCounts.expenses, tone: 'red' },
    { key: 'matched', label: 'Matched', count: tabCounts.matched, tone: 'green' },
  ];
  const tabTone = { gold: 'bg-[#d4af37]/20 text-[#f5d77f]', green: 'bg-emerald-500/20 text-emerald-400', red: 'bg-red-500/20 text-red-400', blue: 'bg-sky-500/20 text-sky-300' };

  const matchButton = (
    <button
      type="button"
      disabled={!canMatch || isPending}
      onClick={() => handleMatchAndClear()}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-all ${canMatch ? 'gold-btn text-black shadow-[0_0_24px_rgba(212,175,55,0.45)]' : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-600'}`}
    >
      <CheckCircle2 className="h-4 w-4" />{isPending ? '...' : 'MATCH'}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-[#d4af37]/20 px-5 py-4 gold-glass-panel">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">Bank Reconciliation</h2>
        <p className="hidden text-[11px] text-zinc-500 md:block">Pick one card on the left and one on the right, then press MATCH. Statements are uploaded once in Buku Bank.</p>
      </div>

      {/* Mobile MATCH bar */}
      <div className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 lg:hidden">
        <div className="text-xs font-mono">
          {canMatch ? (isExactMatch ? <span className="font-bold text-emerald-400">EXACT MATCH</span> : <span className="font-bold text-yellow-400">DIFF: {rp(diff)}</span>) : <span className="text-zinc-500">Pick 1 left + 1 right</span>}
        </div>
        <div className="w-32">{matchButton}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-230px)] lg:min-h-[560px] lg:grid-cols-[1fr_130px_1fr]">
        {/* LEFT: Buku Bank */}
        <section className="flex min-h-[420px] min-w-0 flex-col rounded-2xl border border-zinc-800 p-4 gold-glass-panel lg:min-h-0">
          <div className="mb-2 flex h-9 items-center gap-2">
            <h3 className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#d4af37]">Buku Bank</h3>
            <select value={activeBankId} onChange={(e) => { setActiveBankId(e.target.value); setSelectedBankId(null); }} className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 font-mono text-[11px] font-bold text-[#f5d77f] outline-none focus:border-[#d4af37]/60">
              {bankAccounts.length === 0 ? <option value="">No bank registered</option> : bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bank_name} | {b.account_number}{b.account_holder ? ` | ${b.account_holder}` : ''}</option>)}
            </select>
          </div>
          <div className="mb-2 flex h-9 items-center gap-2">
            <Segment value={activeFilterTab} onChange={setActiveFilterTab} options={[{ key: 'all', label: 'All' }, { key: 'matched', label: 'Matched', tone: 'green' }, { key: 'unmatched', label: 'Not Found', tone: 'red' }]} />
            <Segment value={dirFilter} onChange={setDirFilter} options={[{ key: 'all', label: 'All' }, { key: 'in', label: 'In', tone: 'green' }, { key: 'out', label: 'Out', tone: 'red' }]} />
            <span className="ml-auto font-mono text-[10px] text-zinc-500">{filteredBankLines.length} open</span>
          </div>
          <div className="mb-3 flex h-9 items-center"><MonthFilter month={bankMonth} year={bankYear} years={years} onChange={(m, y) => { setBankMonth(m); setBankYear(y); }} /></div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredBankLines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                {bankLines.length === 0 ? 'No open line in Buku Bank for this account. Upload a statement in Buku Bank.' : 'No line for these filters.'}
              </div>
            ) : filteredBankLines.map((line) => {
              const isSel = selectedBankId === line.id;
              const hint = findBestMatch(line);
              return (
                <div
                  key={line.id}
                  onClick={() => pickBankLine(line)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${isSel ? 'border-[#f5d77f] bg-[#d4af37]/15 shadow-[0_0_18px_rgba(212,175,55,0.22)]' : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'}`}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-zinc-400">{formatIndoDate(line.date)}</span>
                    <span className={`font-bold ${line.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{signed(line.amount)}</span>
                  </div>
                  <div className="mt-1 truncate text-xs font-medium text-white">{line.sourceDestination || '-'}</div>
                  {(line.transactionDetails || line.notes) && <div className="mt-0.5 truncate text-[10px] text-zinc-500">{[line.transactionDetails, line.notes].filter(Boolean).join(' | ')}</div>}
                  <div className="mt-2 flex items-center justify-between">
                    {hint ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">Match found</span> : <span className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[9px] font-bold text-zinc-500">No match</span>}
                    <div className="flex items-center gap-1">
                      {line.amount < 0 ? (
                        <button type="button" title="No match: create an expense" aria-label="Create expense" onClick={(e) => { e.stopPropagation(); openNoMatch(line, 'expense'); }} className="rounded-md border border-red-500/30 p-1 text-red-400 hover:bg-red-500/10"><Receipt className="h-3.5 w-3.5" /></button>
                      ) : (
                        <>
                          <button type="button" title="No match: record an invoice payment" aria-label="Record invoice payment" onClick={(e) => { e.stopPropagation(); openNoMatch(line, 'invoice'); }} className="rounded-md border border-sky-500/30 p-1 text-sky-300 hover:bg-sky-500/10"><FileText className="h-3.5 w-3.5" /></button>
                          <button type="button" title="No match: create a direct income" aria-label="Create direct income" onClick={(e) => { e.stopPropagation(); openNoMatch(line, 'income'); }} className="rounded-md border border-emerald-500/30 p-1 text-emerald-400 hover:bg-emerald-500/10"><Banknote className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* MIDDLE: match */}
        <div className="hidden flex-col items-center justify-center gap-3 lg:flex">
          <div className="w-full space-y-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-center font-mono text-[10px]">
            <div className="text-zinc-500">BANK</div>
            <div className="font-bold text-zinc-200">{activeBankLine ? rp(bankAmt) : '-'}</div>
            <div className="pt-1 text-zinc-500">SYSTEM</div>
            <div className="font-bold text-zinc-200">{selectedRecords.length > 0 ? rp(systemAmt) : '-'}</div>
            {canMatch && (
              <div className={`mt-1 rounded-md px-1 py-0.5 font-bold ${isExactMatch ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                {isExactMatch ? 'EXACT' : `DIFF ${rp(diff)}`}
              </div>
            )}
          </div>
          {matchButton}
          <ArrowRight className="h-4 w-4 text-zinc-700" />
        </div>

        {/* RIGHT: System */}
        <section className="flex min-h-[420px] min-w-0 flex-col rounded-2xl border border-zinc-800 p-4 gold-glass-panel lg:min-h-0">
          <div className="mb-2 flex h-9 items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">System</h3>
            <span className="font-mono text-[10px] text-zinc-500">{selectedRecords.length > 0 ? `${selectedRecords.length} selected` : ''}</span>
          </div>
          <div className="mb-2 flex h-9 items-center">
            <div className="grid w-full grid-cols-4 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
              {tabs.map((t) => (
                <button key={t.key} type="button" onClick={() => { setRightTab(t.key); setPayError(''); }} className={`truncate rounded-md px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${rightTab === t.key ? tabTone[t.tone || 'gold'] : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {t.label} <span className="font-mono opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex h-9 items-center">
            {rightTab === 'unpaid'
              ? <input value={paySearch} onChange={(e) => setPaySearch(e.target.value)} placeholder="Search client or invoice number" className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-100 outline-none focus:border-sky-500/50" />
              : <MonthFilter month={sysMonth} year={sysYear} years={years} onChange={(m, y) => { setSysMonth(m); setSysYear(y); }} />}
          </div>

          {rightTab === 'unpaid' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {payError && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-300">{payError}</div>}
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {payShown.length === 0 && <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">No unpaid invoice found.</div>}
                {payShown.map((i) => {
                  const exact = Boolean(activeBankLine && activeBankLine.amount > 0 && Math.abs(i.balance - activeBankLine.amount) < 1);
                  return (
                    <div key={i.id} className={`rounded-xl border p-3 ${exact ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800/80 bg-zinc-950/60'}`}>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-zinc-400">{formatIndoDate(i.date)} · {i.number}</span>
                        <span className="font-bold text-[#f5d77f]">{rp(i.balance)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-white">{i.client}</span>
                        {exact && <span className="shrink-0 rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">SAME AMOUNT</span>}
                      </div>
                      {i.paid > 0 && <div className="text-[10px] text-zinc-600">paid {rp(i.paid)} of {rp(i.total)}</div>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button disabled={payBusy !== null} onClick={() => payOneInvoice(i, i.balance)} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40">{payBusy === i.id ? '...' : 'Paid'}</button>
                        <input type="number" min={1} placeholder="Partial Rp" value={payPartial[i.id] ?? ''} onChange={(e) => setPayPartial({ ...payPartial, [i.id]: e.target.value === '' ? '' : Number(e.target.value) })} className="w-[110px] rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-right font-mono text-[11px] text-zinc-100 outline-none" />
                        <button disabled={payBusy !== null || !payPartial[i.id]} onClick={() => payOneInvoice(i, Number(payPartial[i.id] || 0))} className="rounded-lg border border-sky-500/40 px-3 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/10 disabled:opacity-40">Partial</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredSystemRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                  {rightTab === 'matched' ? 'Nothing matched in this period.' : rightTab === 'expenses' ? 'No open expense in this period.' : 'No open cash received in this period.'}
                </div>
              ) : filteredSystemRecords.map((rec) => {
                const isSelected = selectedRecordIds.includes(rec.id);
                const isBest = bestMatchRecord?.id === rec.id;
                const amountMatch = activeBankLine && Math.abs(rec.amount - Math.abs(activeBankLine.amount)) < 0.01;
                return (
                  <div
                    key={rec.id}
                    onClick={() => { if (!rec.reconciled) setSelectedRecordIds((prev) => prev.includes(rec.id) ? prev.filter((id) => id !== rec.id) : [...prev, rec.id]); }}
                    className={`rounded-xl border p-3 transition-all ${rec.reconciled ? 'border-zinc-800/80 bg-zinc-950/60' : 'cursor-pointer'} ${isSelected ? 'border-[#f5d77f] bg-[#d4af37]/15 shadow-[0_0_18px_rgba(212,175,55,0.22)]' : isBest ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50' : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'}`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-zinc-400">{formatIndoDate(rec.date)}</span>
                      <span className={`font-bold ${rec.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{signed(rec.amount)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-white">{rec.payeeOrClient || rec.reference}</span>
                      <span className="shrink-0 rounded border border-[#d4af37]/20 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#d4af37]">{rec.type}</span>
                    </div>
                    {rec.notes && <div className="mt-0.5 truncate text-[10px] text-zinc-500">{rec.notes}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {rightTab !== 'matched' && (rec.reconciled
                        ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">Reconciled</span>
                        : <span className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[9px] font-bold text-zinc-400">Not reconciled</span>)}
                      {!rec.reconciled && isBest && amountMatch && <span className="rounded-full bg-[#d4af37]/10 px-2 py-0.5 text-[9px] font-bold text-[#f5d77f]">Suggested</span>}
                      {rec.reconciled && (
                        <button type="button" disabled={isPending} onClick={(e) => { e.stopPropagation(); handleUndoMatch(rec); }} className="ml-auto rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-500/20 disabled:opacity-40">Undo match</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* No match window: create the missing record for the chosen bank card */}
      {noMatchMode && activeBankLine && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-[#d4af37]/30 p-5 gold-glass-panel">
            <div className="mb-4 flex items-center gap-3">
              <button type="button" onClick={() => setNoMatchMode(null)} className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:border-[#d4af37]/60 hover:text-[#f5d77f]" aria-label="Back to bank reconcile" title="Back to bank reconcile"><ArrowLeft className="h-4 w-4" /></button>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#f5d77f]">{modalTitle}</h3>
                <p className="truncate font-mono text-[11px] text-zinc-500">{formatIndoDate(activeBankLine.date)} · {signed(activeBankLine.amount)} · {activeBankLine.sourceDestination}</p>
              </div>
            </div>

            {noMatchMode === 'invoice' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <p className="mb-2 text-[11px] text-zinc-500">The bank amount is recorded as the payment of the invoice and matched with this bank card at once. The closest invoices are on top.</p>
                <input value={paySearch} onChange={(e) => setPaySearch(e.target.value)} placeholder="Search client or invoice number" className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/50" />
                {payError && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-300">{payError}</div>}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {payShown.length === 0 && <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">No unpaid invoice found.</div>}
                  {payShown.map((i) => {
                    const exact = Math.abs(i.balance - activeBankLine.amount) < 1;
                    const tooBig = Math.abs(activeBankLine.amount) > i.balance + 0.5;
                    return (
                      <div key={i.id} className={`rounded-xl border p-3 ${exact ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800/80 bg-zinc-950/60'}`}>
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="text-zinc-400">{formatIndoDate(i.date)} · {i.number}</span>
                          <span className="font-bold text-[#f5d77f]">{rp(i.balance)}</span>
                        </div>
                        <div className="mt-1 truncate text-xs font-medium text-white">{i.client}</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-zinc-500">{exact ? 'Same amount: invoice is paid in full' : tooBig ? 'Bank amount is more than the balance' : 'Partial payment'}</span>
                          <button type="button" disabled={payBusy !== null || tooBig} onClick={() => payInvoiceFromBankLine(i)} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40">{payBusy === i.id ? '...' : `Record ${rp(activeBankLine.amount)}`}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="relative">
                  <label className={label}>{noMatchMode === 'expense' ? 'Vendor / Payee' : 'Payer'}</label>
                  <input type="text" placeholder="Search or enter name..." value={quickVendorName}
                    onChange={(e) => { setQuickVendorName(e.target.value); setQuickVendorId(undefined); setVendorDropdownOpen(true); }}
                    onFocus={() => setVendorDropdownOpen(true)} onBlur={() => setTimeout(() => setVendorDropdownOpen(false), 200)}
                    className={field} />
                  {vendorDropdownOpen && (
                    <div className="absolute top-[100%] z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
                      {Array.from(new Map(
                        localVendors
                          .filter((v) => v.name.toLowerCase().includes(quickVendorName.toLowerCase()))
                          .map((v) => [v.name.trim().toLowerCase(), v])
                      ).values()).map((v) => (
                        <div key={v.id} onMouseDown={(e) => { e.preventDefault(); setQuickVendorName(v.name); setQuickVendorId(v.id); setVendorDropdownOpen(false); }} className="cursor-pointer px-4 py-2.5 text-xs text-white hover:bg-[#d4af37]/20">{v.name}</div>
                      ))}
                      {quickVendorName.trim() && !localVendors.some((v) => v.name.toLowerCase() === quickVendorName.toLowerCase()) && (
                        <div onMouseDown={(e) => { e.preventDefault(); handleQuickAddVendor(); }} className="flex cursor-pointer items-center gap-2 border-t border-zinc-800 px-4 py-3 text-xs font-bold text-[#f5d77f] hover:bg-[#d4af37]/20">
                          {isQuickAddingVendor ? <span className="animate-pulse">ADDING...</span> : <span>+ QUICK ADD: &ldquo;{quickVendorName}&rdquo;</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className={label}>Category</label>
                  <input type="text" placeholder="Search category..." value={quickCategory}
                    onChange={(e) => { setQuickCategory(e.target.value); setCoaDropdownOpen(true); }}
                    onFocus={() => setCoaDropdownOpen(true)} onBlur={() => setTimeout(() => setCoaDropdownOpen(false), 200)}
                    className={field} />
                  {coaDropdownOpen && (
                    <div className="absolute top-[100%] z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
                      {Object.entries(coaAccounts.reduce((acc, curr) => { if (!acc[curr.account_type]) acc[curr.account_type] = []; acc[curr.account_type].push(curr); return acc; }, {} as Record<string, COAAccountMinimal[]>)).map(([type, accounts]) => {
                        const filtered = accounts.filter((a) => (a.account_code + ' - ' + a.account_name).toLowerCase().includes(quickCategory.toLowerCase()));
                        if (filtered.length === 0) return null;
                        const isExpanded = expandedCoaGroups[type] !== undefined ? expandedCoaGroups[type] : quickCategory.length > 0;
                        return (
                          <div key={type}>
                            <div className="sticky top-0 flex cursor-pointer items-center gap-1 bg-zinc-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white"
                              onMouseDown={(e) => { e.preventDefault(); setExpandedCoaGroups((prev) => ({ ...prev, [type]: !(prev[type] !== undefined ? prev[type] : quickCategory.length > 0) })); }}>
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{type}
                            </div>
                            {isExpanded && filtered.map((coa) => (
                              <div key={coa.account_code} onMouseDown={(e) => { e.preventDefault(); setQuickCategory(coa.account_code + ' - ' + coa.account_name); setCoaDropdownOpen(false); }}
                                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white">
                                <span className="font-mono text-[#f5d77f]">{coa.account_code}</span><span>{coa.account_name}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Date</label>
                    <DatePickerUI value={quickDate} onChange={setQuickDate} />
                  </div>
                  <div>
                    <label className={label}>Amount</label>
                    <RupiahInput placeholder="Rp 0" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value === '' ? '' : Number(e.target.value))} className={`${field} font-mono font-bold text-[#f5d77f]`} />
                  </div>
                </div>
                <div>
                  <label className={label}>Notes</label>
                  <textarea rows={2} value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} className={`${field} text-xs`} />
                </div>
                {noMatchMode === 'expense' ? (
                  <button type="button" disabled={isPending || activeBankLine.amount > 0} onClick={() => handleQuickResolve('expense')} className="w-full rounded-xl border border-red-400/30 bg-red-400/10 py-3 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40">{isPending ? '...' : 'Save expense and match'}</button>
                ) : (
                  <button type="button" disabled={isPending || activeBankLine.amount < 0} onClick={() => handleQuickResolve('income')} className="w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-3 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40">{isPending ? '...' : 'Save direct income and match'}</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {optionsDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#d4af37]/30 p-6 shadow-[0_0_50px_rgba(212,175,55,0.15)] gold-glass-panel">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#f5d77f]">
              <Sparkles className="h-5 w-5" />
              {optionsDialog.title}
            </h3>
            <div className="mb-8 font-sans text-zinc-300">{optionsDialog.message}</div>
            <div className="mt-4 flex flex-col gap-2">
              {optionsDialog.buttons.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => optionsDialog.onSelect(btn.value)}
                  className={`w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                    btn.isPrimary
                      ? 'gold-btn text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:shadow-[0_0_30px_rgba(212,175,55,0.6)]'
                      : btn.isDanger
                      ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'border border-zinc-700/50 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {btn.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
