'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Loader2 } from 'lucide-react';
import { saveBankStatement, type BankBookLineInput } from '@/app/actions/bank-book';
import { bankLabel, type BankBookAccount } from '@/components/bank-book/BankBookTable';

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-[#f5d77f] focus:border-[#d4af37]/60 focus:outline-none';

/** Upload a bank statement (PDF or CSV) into Buku Bank. Choose the bank account first. Lines already stored are skipped. */
export function BankStatementUpload({ banks }: { banks: BankBookAccount[] }) {
  const router = useRouter();
  const [bankId, setBankId] = useState(banks[0]?.id || '');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // Opening balance only: keep just the last saldo of the statement (for the month before the first one you keep in full).
  const [lastOnly, setLastOnly] = useState(false);

  const bank = banks.find((b) => b.id === bankId);
  // PDF layouts: BCA Business statements and Jago statements are read differently.
  const bankFormat = bank?.bankName?.toLowerCase().includes('bca') ? 'bca_business' : 'jago';

  const parseCsv = (text: string): BankBookLineInput[] => {
    const rows = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const out: BankBookLineInput[] = [];
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i].split(',');
      if (c.length < 3) continue;
      const amount = parseFloat((c[2] || '').trim().replace(/[^0-9.-]/g, ''));
      const date = c[0]?.trim();
      if (!date || Number.isNaN(amount)) continue;
      out.push({ date, sourceDestination: c[1]?.trim() || '', transactionDetails: c[3]?.trim() || '', notes: c[4]?.trim() || '', rekFrom: c[5]?.trim() || '', amount });
    }
    return out;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !bankId) return;
    setNotice(null);
    start(async () => {
      try {
        let lines: BankBookLineInput[] = [];
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const form = new FormData();
          form.append('file', file);
          form.append('bankFormat', bankFormat);
          const res = await fetch('/api/v1/reconcile/parse-pdf', { method: 'POST', body: form });
          const json = await res.json();
          if (!json.success) { setNotice({ ok: false, text: `Could not read the PDF: ${json.error || 'unknown error'}` }); return; }
          lines = (json.data || []).map((t: any) => ({
            date: t.date, sourceDestination: t.sourceDestination || '', transactionDetails: t.transactionDetails || '',
            notes: t.notes || '', rekFrom: t.rekFrom || '', amount: Number(t.amount),
            balance: typeof t.balance === 'number' ? t.balance : undefined, time: t.time || undefined,
          }));
        } else {
          lines = parseCsv(await file.text());
        }
        if (lines.length === 0) { setNotice({ ok: false, text: 'No transaction lines found in that file.' }); return; }
        if (lastOnly) {
          const withBalance = lines.map((l, i) => ({ l, i })).filter((x) => typeof x.l.balance === 'number');
          if (withBalance.length === 0) { setNotice({ ok: false, text: 'This file has no saldo (balance) column, so there is no last balance to keep.' }); return; }
          const last = withBalance.sort((a, b) => `${a.l.date} ${a.l.time || ''}`.localeCompare(`${b.l.date} ${b.l.time || ''}`) || a.i - b.i).pop()!.l;
          // One row with no money moved: it only carries the saldo of the last day.
          lines = [{ date: last.date, sourceDestination: 'Opening balance', transactionDetails: 'Last saldo of the statement', notes: '', rekFrom: '', amount: 0, balance: last.balance, time: last.time }];
        }
        const res = await saveBankStatement(bankId, file.name, lines);
        if (!res.success) { setNotice({ ok: false, text: res.error || 'Could not store the statement.' }); return; }
        setNotice({ ok: true, text: lastOnly ? `${file.name}: last saldo kept (${lines[0].date}).` : `${file.name}: ${res.saved} new line(s) stored${res.skipped ? `, ${res.skipped} were already there` : ''}.` });
        router.refresh();
      } catch (err: any) {
        setNotice({ ok: false, text: err?.message || 'Upload failed.' });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
      <select value={bankId} onChange={(e) => setBankId(e.target.value)} className={`${field} min-w-[220px]`} title="Which bank account is this statement of?">
        {banks.length === 0 && <option value="">No bank account registered</option>}
        {banks.map((b) => <option key={b.id} value={b.id}>{bankLabel(b)}</option>)}
      </select>
      <label className={`relative flex cursor-pointer items-center gap-2 rounded-full border border-[#d4af37]/40 bg-gradient-to-r from-transparent via-[#d4af37]/10 to-transparent px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f5d77f] transition-all hover:border-[#d4af37] hover:bg-[#d4af37]/20 ${!bankId ? 'pointer-events-none opacity-40' : ''}`}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        <span>{pending ? 'Reading the statement...' : 'Upload bank statement'}</span>
        <input type="file" accept=".csv,.pdf" className="hidden" onChange={handleFile} disabled={pending || !bankId} />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-zinc-300" title="Keep only the saldo of the last line (Opening Balance); the other lines are not stored">
        <input type="checkbox" checked={lastOnly} onChange={(e) => setLastOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[#d4af37]" /> Keep only the last saldo (opening balance)
      </label>
      <span className="text-[11px] text-zinc-500">PDF or CSV. Choose the bank account first.</span>
      {notice && <div className={`w-full text-xs ${notice.ok ? 'text-emerald-400' : 'text-red-400'}`}>{notice.text}</div>}
    </div>
  );
}
