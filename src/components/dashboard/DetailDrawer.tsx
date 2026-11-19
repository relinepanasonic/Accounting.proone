'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { SALARY_ACCOUNT_CODES_PUBLIC as SALARY_CODES } from '@/lib/data/dashboard-constants';
import type { DashboardDetails } from '@/lib/data/dashboard';

export type DetailKind = 'revenue' | 'paid' | 'avgMonthly' | 'avgOrder' | 'clients' | 'cogs' | 'expenses' | 'cost' | 'salary' | 'cash' | 'ar';

const rp = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const TITLE: Record<DetailKind, string> = {
  revenue: 'Total Revenue: billed invoices', paid: 'Paid Revenue: paid invoices', avgMonthly: 'MRR: invoices by month', avgOrder: 'Avg Order Value: invoices',
  clients: 'Clients with invoices', cogs: 'Total COGS: ledger lines (accounts 5xxx)', expenses: 'Expenses: ledger lines without COGS (accounts 6xxx to 9xxx)', cost: 'Total Cost: ledger lines', salary: 'Total Salary: accounts 5020 + 6001', cash: 'Total Cash: money in and out', ar: 'Total A/R: unpaid balances',
};

const th = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500';
const td = 'px-3 py-2 text-xs text-zinc-200';

/** Click a card, see the rows behind its number. Returns the opener and the drawer to render. */
export function useDetailDrawer(details?: DashboardDetails) {
  const [kind, setKind] = useState<DetailKind | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleAcc = (k: string) => setExpanded((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const open = (k: DetailKind) => { setSearch(''); setExpanded(new Set()); setKind(k); };

  // The drawer is a step in the browser history: the phone's Back button (or gesture) closes it and lands on the same dashboard,
  // with the same Year / Month / Company filters, instead of leaving the page.
  const close = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.detailDrawer) window.history.back();
    else setKind(null);
  }, []);
  useEffect(() => {
    if (!kind) return;
    window.history.pushState({ ...(window.history.state || {}), detailDrawer: true }, '');
    const onPop = () => setKind(null);
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('popstate', onPop); document.body.style.overflow = prev; };
  }, [kind]);

  const content = useMemo(() => {
    if (!kind || !details) return null;
    const q = search.trim().toLowerCase();
    const has = (...t: (string | null)[]) => !q || t.some((x) => (x || '').toLowerCase().includes(q));

    if (kind === 'revenue' || kind === 'avgOrder' || kind === 'paid' || kind === 'avgMonthly') {
      if (kind === 'avgMonthly') {
        const by = new Map<string, { n: number; sum: number }>();
        for (const i of details.invoices) { const m = (i.date || '').slice(0, 7) || '-'; const c = by.get(m) || { n: 0, sum: 0 }; by.set(m, { n: c.n + 1, sum: c.sum + i.total }); }
        const rows = Array.from(by.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        return { total: rows.reduce((s, r) => s + r[1].sum, 0), head: ['Month', 'Invoices', 'Billed'], rows: rows.map(([m, v]) => [m, String(v.n), rp(v.sum)]), right: [2] };
      }
      const list = details.invoices.filter((i) => (kind === 'paid' ? i.status === 'paid' : true) && has(i.number, i.client, i.status)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return { total: list.reduce((s, i) => s + i.total, 0), head: ['Invoice', 'Client', 'Date', 'Status', 'Amount'], rows: list.map((i) => [i.number || '-', i.client, day(i.date), i.status, rp(i.total)]), right: [4] };
    }
    if (kind === 'clients') {
      const by = new Map<string, { n: number; sum: number }>();
      for (const i of details.invoices) { const c = by.get(i.client) || { n: 0, sum: 0 }; by.set(i.client, { n: c.n + 1, sum: c.sum + i.total }); }
      const rows = Array.from(by.entries()).filter(([c]) => has(c)).sort((a, b) => b[1].sum - a[1].sum);
      return { total: rows.reduce((s, r) => s + r[1].sum, 0), head: ['Client', 'Invoices', 'Billed'], rows: rows.map(([c, v]) => [c, String(v.n), rp(v.sum)]), right: [2] };
    }
    if (kind === 'ar') {
      const list = details.ar.filter((i) => has(i.number, i.client, i.status)).sort((a, b) => String(a.due || a.date).localeCompare(String(b.due || b.date)));
      return { total: list.reduce((s, i) => s + i.balance, 0), head: ['Invoice', 'Client', 'Due', 'Status', 'Balance'], rows: list.map((i) => [i.number || '-', i.client, day(i.due), i.status.replace('_', ' '), rp(i.balance)]), right: [4] };
    }
    if (kind === 'cash') {
      const list = details.cash.filter((c) => has(c.label)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return { total: list.reduce((s, c) => s + c.amount, 0), head: ['Date', 'What', 'Amount'], rows: list.map((c) => [day(c.date), c.label, rp(c.amount)]), right: [2] };
    }
    // cost-side kinds: grouped per account, then the lines
    const lines = details.costs.filter((c) => (kind === 'cogs' ? c.cogs : kind === 'expenses' ? !c.cogs : kind === 'salary' ? SALARY_CODES.includes(c.code) : true) && has(c.account, c.code));
    const byAcc = new Map<string, number>();
    for (const l of lines) byAcc.set(`${l.code} - ${l.account}`, (byAcc.get(`${l.code} - ${l.account}`) || 0) + l.amount);
    const rows = Array.from(byAcc.entries()).sort((a, b) => b[1] - a[1]);
    const sortedLines = [...lines].sort((a, b) => b.date.localeCompare(a.date));
    const groups = rows.map(([a, v]) => ({ key: a, total: v, lines: sortedLines.filter((l) => `${l.code} - ${l.account}` === a) }));
    return { total: lines.reduce((s, l) => s + l.amount, 0), head: ['Account', 'Amount'], rows: rows.map(([a, v]) => [a, rp(v)]), right: [1], lines: sortedLines, groups };
  }, [kind, details, search]);

  const element = kind && content ? (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/60" onClick={close}>
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-[#d4af37]/20 bg-[#0b0c10]" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={close} className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm font-bold text-[#f5d77f] hover:bg-zinc-900">
          <ArrowLeft className="h-5 w-5" /> Back to Accounting
        </button>
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div>
            <h2 className="font-serif text-lg font-extrabold text-zinc-100">{TITLE[kind]}</h2>
            <p className="mt-1 text-xs text-zinc-500">{content.rows.length} row{content.rows.length === 1 ? '' : 's'} · total <b className="text-[#f5d77f]">{rp(content.total)}</b></p>
          </div>
          <button onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-zinc-800 p-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none" />
        </div>
        <div className="flex-1 overflow-auto p-3">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#0b0c10]"><tr>{content.head.map((h, i) => <th key={h} className={`${th} ${content.right.includes(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-zinc-800/50">
              {content.rows.length === 0 && <tr><td colSpan={content.head.length} className="p-6 text-center text-sm text-zinc-500">Nothing in this period.</td></tr>}
              {'groups' in content && content.groups ? content.groups.map((g) => {
                const isOpen = expanded.has(g.key);
                return (
                  <React.Fragment key={g.key}>
                    <tr onClick={() => toggleAcc(g.key)} className="cursor-pointer hover:bg-zinc-900/40" aria-expanded={isOpen}>
                      <td className={td}><span className="mr-2 inline-block w-3 text-[#d4af37]">{isOpen ? '▾' : '▸'}</span>{g.key} <span className="text-[10px] text-zinc-500">· {g.lines.length} line{g.lines.length === 1 ? '' : 's'}</span></td>
                      <td className={`${td} whitespace-nowrap text-right font-mono`}>{rp(g.total)}</td>
                    </tr>
                    {isOpen && g.lines.map((l, i) => (
                      <tr key={i} className="bg-zinc-950/60">
                        <td className="py-1.5 pl-9 pr-3 text-[11px] text-zinc-400"><span className="mr-2 font-mono text-zinc-500">{day(l.date)}</span>{l.desc || <span className="text-zinc-600">no description</span>}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[11px] text-zinc-300">{rp(l.amount)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              }) : content.rows.map((r, i) => (
                <tr key={i} className="hover:bg-zinc-900/40">{r.map((c, j) => <td key={j} className={`${td} ${content.right.includes(j) ? 'whitespace-nowrap text-right font-mono' : ''}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ) : null;

  return [open, element] as const;
}
