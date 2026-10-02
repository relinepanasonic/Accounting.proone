'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Search, XCircle } from 'lucide-react';
import type { CheckFlag, CheckResult, CheckRow } from '@/lib/accounting/ledger-check';
import { saveLedgerCheck } from '@/app/actions/ledger-check';

// Kept here (not imported from the server loader) so this client file stays small.
const FLAGS: Record<CheckFlag, { label: string; explain: string; tone: 'red' | 'amber' }> = {
  POSTED_WRONG: { label: 'Posted ≠ total', explain: 'The receivable posted to the ledger is not the invoice total.', tone: 'red' },
  DUP_BANK: { label: 'Bank transfer used twice', explain: 'The same bank transfer is posted more than once to this invoice.', tone: 'red' },
  OVERPAID: { label: 'Paid > total', explain: 'The invoice says more was paid than it is worth.', tone: 'red' },
  WRONG_ACCOUNT: { label: 'Wrong account', explain: 'A receivable line is on an account that is not Accounts Receivable.', tone: 'red' },
  OPEN_DIFF: { label: 'Ledger ≠ invoice balance', explain: 'What is still owed in the ledger differs from what the invoice says is still owed.', tone: 'amber' },
  NOT_POSTED: { label: 'Not in ledger', explain: 'A sent / paid invoice with no receivable in the ledger.', tone: 'amber' },
  DRAFT_POSTED: { label: 'Draft in ledger', explain: 'A draft should not be in the books yet, but it has ledger lines.', tone: 'amber' },
};

const rp = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.abs(Math.round(n)).toLocaleString('id-ID')}`;
const day = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: '2-digit' }) : '-');

function Chip({ flag }: { flag: CheckFlag }) {
  const f = FLAGS[flag];
  return (
    <span title={f.explain} className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${f.tone === 'red' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
      {f.label}
    </span>
  );
}

function CheckCell({ row }: { row: CheckRow }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState(row.check?.note || '');
  const [error, setError] = useState('');
  const save = (verdict: 'ok' | 'problem' | null) =>
    start(async () => {
      setError('');
      const res = await saveLedgerCheck(row.id, verdict, note);
      if (!res.success) setError(res.error || 'Could not save.');
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={() => save('ok')} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase ${row.check?.verdict === 'ok' ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200' : 'border-zinc-700 text-zinc-400 hover:text-emerald-300'}`}>
          <CheckCircle2 className="h-3 w-3" /> Checked OK
        </button>
        <button disabled={pending} onClick={() => save('problem')} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase ${row.check?.verdict === 'problem' ? 'border-red-500/50 bg-red-500/20 text-red-200' : 'border-zinc-700 text-zinc-400 hover:text-red-300'}`}>
          <XCircle className="h-3 w-3" /> Problem
        </button>
        {row.check && (
          <button disabled={pending} onClick={() => save(null)} className="text-[10px] text-zinc-500 underline hover:text-zinc-300">clear</button>
        )}
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d4af37]" />}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Note for the team (what you checked, what is wrong)"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 focus:border-[#d4af37] focus:outline-none"
      />
      {row.check && <div className="text-[10px] text-zinc-500">Last marked by {row.check.by || '?'} · {new Date(row.check.at).toLocaleString('id-ID')}</div>}
      {error && <div className="text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

export function LedgerCheckTable({ data }: { data: CheckResult }) {
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [flag, setFlag] = useState<CheckFlag | ''>('');
  const [mark, setMark] = useState<'' | 'unchecked' | 'ok' | 'problem'>('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Partial<Record<CheckFlag, number>> = {};
    data.rows.forEach((r) => r.flags.forEach((f) => (c[f] = (c[f] || 0) + 1)));
    return c;
  }, [data.rows]);
  const flagged = data.rows.filter((r) => r.flags.length > 0).length;
  const checked = data.rows.filter((r) => r.check).length;
  const arTotal = data.arAccounts.reduce((s, a) => s + a.balance, 0);

  const rows = data.rows.filter(
    (r) =>
      (!onlyProblems || r.flags.length > 0) &&
      (!flag || r.flags.includes(flag)) &&
      (!mark || (mark === 'unchecked' ? !r.check : r.check?.verdict === mark)) &&
      (!q || `${r.number} ${r.client}`.toLowerCase().includes(q.toLowerCase()))
  );

  const exportCsv = () => {
    const head = ['Invoice', 'Client', 'Status', 'Issue date', 'Total', 'Paid (invoice)', 'Posted (ledger)', 'Received (ledger)', 'Owed (ledger)', 'Owed (invoice)', 'Problems', 'Check', 'Note'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = rows.map((r) =>
      [r.number, r.client, r.status, r.issueDate, r.total, r.paidApp, r.posted, r.received, r.ledgerOpen, r.appOpen, r.flags.map((f) => FLAGS[f].label).join('; '), r.check?.verdict || '', r.check?.note || '']
        .map(esc)
        .join(',')
    );
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledger-check-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      {!data.checksReady && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          To save "Checked OK / Problem" marks, run <span className="font-mono">supabase/migrations/20261002_ledger_checks.sql</span> in Supabase.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Invoices</div>
          <div className="mt-1 text-2xl font-extrabold text-zinc-100">{data.rows.length}</div>
          <div className="text-[10px] text-zinc-500">{checked} marked by the team</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">With a problem</div>
          <div className={`mt-1 text-2xl font-extrabold ${flagged ? 'text-red-300' : 'text-emerald-300'}`}>{flagged}</div>
          <div className="text-[10px] text-zinc-500">{data.rows.length - flagged} add up</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Owed, per invoices</div>
          <div className="mt-1 text-xl font-extrabold text-zinc-100">{rp(data.invoicesOwe)}</div>
          <div className="text-[10px] text-zinc-500">total minus paid, sent/paid invoices</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Owed, per ledger</div>
          <div className={`mt-1 text-xl font-extrabold ${Math.abs(arTotal - data.invoicesOwe) > 1 ? 'text-red-300' : 'text-emerald-300'}`}>{rp(arTotal)}</div>
          <div className="text-[10px] text-zinc-500">
            {data.arAccounts.map((a) => `${a.code} ${rp(a.balance)}`).join(' · ')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Only problems
        </label>
        {(Object.keys(FLAGS) as CheckFlag[]).filter((f) => counts[f]).map((f) => (
          <button
            key={f}
            onClick={() => setFlag(flag === f ? '' : f)}
            title={FLAGS[f].explain}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${flag === f ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
          >
            {FLAGS[f].label} ({counts[f]})
          </button>
        ))}
        <select value={mark} onChange={(e) => setMark(e.target.value as any)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300">
          <option value="">All marks</option>
          <option value="unchecked">Not checked yet</option>
          <option value="ok">Checked OK</option>
          <option value="problem">Problem</option>
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice or client" className="w-48 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-2 text-xs text-zinc-200 focus:border-[#d4af37] focus:outline-none" />
        </div>
        <span className="text-[11px] text-zinc-500">{rows.length} shown</span>
        <button onClick={exportCsv} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-300 hover:border-[#d4af37] hover:text-[#f5d77f]">
          <Download className="h-3.5 w-3.5" /> Excel (CSV)
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/15 bg-[#0e0f14]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <th className="p-3" />
              <th className="p-3">Invoice</th>
              <th className="p-3">Client</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Paid (invoice)</th>
              <th className="p-3 text-right">Posted (ledger)</th>
              <th className="p-3 text-right">Received (ledger)</th>
              <th className="p-3">Problems</th>
              <th className="p-3">Team check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-10 text-center text-zinc-500">{onlyProblems ? 'No problems found with these filters.' : 'No invoices.'}</td></tr>
            )}
            {rows.map((r) => {
              const isOpen = open === r.id;
              const off = (a: number, b: number) => Math.abs(a - b) > 1;
              return (
                <React.Fragment key={r.id}>
                  <tr className="cursor-pointer hover:bg-zinc-900/40" onClick={() => setOpen(isOpen ? null : r.id)}>
                    <td className="p-3 text-zinc-500">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="p-3 font-mono font-bold text-[#f5d77f]">{r.number}<div className="font-sans text-[10px] font-normal text-zinc-500">{day(r.issueDate)}</div></td>
                    <td className="p-3 text-zinc-200">{r.client}</td>
                    <td className="p-3 uppercase text-zinc-400">{r.status}</td>
                    <td className="p-3 text-right font-mono text-zinc-100">{rp(r.total)}</td>
                    <td className={`p-3 text-right font-mono ${r.paidApp > r.total + 1 ? 'text-red-300' : 'text-zinc-300'}`}>{rp(r.paidApp)}</td>
                    <td className={`p-3 text-right font-mono ${r.status !== 'draft' && off(r.posted, r.total) ? 'text-red-300' : 'text-zinc-300'}`}>{rp(r.posted)}</td>
                    <td className={`p-3 text-right font-mono ${off(r.received, r.paidApp) ? 'text-amber-300' : 'text-zinc-300'}`}>{rp(r.received)}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-1">{r.flags.length ? r.flags.map((f) => <Chip key={f} flag={f} />) : <span className="text-emerald-400">✓ adds up</span>}</div></td>
                    <td className="p-3">
                      {r.check ? (
                        <span className={`text-[10px] font-bold uppercase ${r.check.verdict === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{r.check.verdict === 'ok' ? 'Checked OK' : 'Problem'}</span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">not checked</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-black/30">
                      <td />
                      <td colSpan={9} className="space-y-4 p-4">
                        {r.flags.length > 0 && (
                          <ul className="space-y-1 text-xs">
                            {r.flags.map((f) => (
                              <li key={f} className={FLAGS[f].tone === 'red' ? 'text-red-300' : 'text-amber-300'}>• {FLAGS[f].explain}</li>
                            ))}
                          </ul>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                          <div><div className="text-[10px] uppercase text-zinc-500">Still owed per invoice</div><div className="font-mono text-zinc-100">{rp(r.appOpen)}</div></div>
                          <div><div className="text-[10px] uppercase text-zinc-500">Still owed per ledger</div><div className={`font-mono ${off(r.ledgerOpen, r.appOpen) && r.status !== 'draft' ? 'text-red-300' : 'text-zinc-100'}`}>{rp(r.ledgerOpen)}</div></div>
                          <div className="md:col-span-2">
                            <div className="text-[10px] uppercase text-zinc-500">Bank transfers matched</div>
                            {r.bankRefs.length === 0 ? <div className="text-zinc-500">none</div> : r.bankRefs.map((b) => (
                              <div key={b.ref} className={`truncate font-mono text-[11px] ${b.times > 1 ? 'text-red-300' : 'text-zinc-300'}`} title={b.ref}>{b.times > 1 ? `${b.times}× ` : ''}{b.ref.replace('BANK-REF:', '')}</div>
                            ))}
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-zinc-800">
                          <table className="w-full text-[11px]">
                            <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500">
                              <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-left">Description</th></tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900 text-zinc-300">
                              {r.lines.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-zinc-500">No ledger lines for this invoice.</td></tr>}
                              {r.lines.map((l, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 font-mono">{day(l.date)}</td>
                                  <td className="px-3 py-1.5"><span className="font-mono">{l.account}</span> <span className="text-zinc-500">{l.accountName}</span></td>
                                  <td className="px-3 py-1.5 text-zinc-500">{l.type}</td>
                                  <td className="px-3 py-1.5 text-right font-mono">{l.debit ? rp(l.debit) : ''}</td>
                                  <td className="px-3 py-1.5 text-right font-mono">{l.credit ? rp(l.credit) : ''}</td>
                                  <td className="max-w-[420px] truncate px-3 py-1.5 text-zinc-400" title={l.description}>{l.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="max-w-xl"><CheckCell row={r} /></div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
