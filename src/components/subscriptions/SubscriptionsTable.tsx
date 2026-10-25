'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { Plus, Trash2, Loader2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveSubscription, deleteSubscription, addUsualSubscriptions, type SubscriptionInput } from '@/app/actions/subscriptions';
import { SUBSCRIPTION_CATEGORIES, monthlyIdr } from '@/lib/subscriptions/known';

export interface SubscriptionRow extends SubscriptionInput { id: string }
type Line = SubscriptionInput & { _k: string };

const field = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[#d4af37]/60';
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const blank = (): Line => ({ name: '', category: 'Other', amount: 0, currency: 'IDR', cycle: 'monthly', active: true, _k: `new-${Date.now()}` });

/** One line. The text is held by the page (so the totals follow it); a change is saved when the field is left or a choice is made. */
function Row({ row, usdRate, change, saved, removed }: { row: Line; usdRate: number; change: (next: Line) => void; saved: (id: string) => void; removed: () => void }) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const persist = (next: Line) => {
    if (!next.name.trim()) return; // a new line is saved once it has a name
    setError('');
    start(async () => {
      const res = await saveSubscription(next);
      if (!res.success) setError(res.error || 'Could not save.');
      else if (!next.id && res.id) saved(res.id);
    });
  };
  const choose = (patch: Partial<Line>) => { const next = { ...row, ...patch }; change(next); persist(next); };
  const type = (patch: Partial<Line>) => change({ ...row, ...patch });

  return (
    <tr className={`align-top ${row.active ? '' : 'opacity-50'}`}>
      <td className="min-w-[210px] px-2 py-2">
        <input value={row.name} onChange={(e) => type({ name: e.target.value })} onBlur={() => persist(row)} placeholder="Name" className={`${field} font-bold`} />
        <input value={row.purpose || ''} onChange={(e) => type({ purpose: e.target.value })} onBlur={() => persist(row)} placeholder="What it is used for" className={`${field} mt-1 text-[11px] text-zinc-400`} />
        {error && <div className="mt-1 max-w-[260px] text-[10px] text-red-400">{error}</div>}
      </td>
      <td className="px-2 py-2"><select value={row.category} onChange={(e) => choose({ category: e.target.value })} className={field}>{SUBSCRIPTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
      <td className="min-w-[110px] px-2 py-2"><input value={row.plan || ''} onChange={(e) => type({ plan: e.target.value })} onBlur={() => persist(row)} placeholder="Plan" className={field} /></td>
      <td className="min-w-[120px] px-2 py-2"><input type="number" min={0} value={row.amount || ''} onChange={(e) => type({ amount: Number(e.target.value) })} onBlur={() => persist(row)} placeholder="0" className={`${field} text-right font-mono`} /></td>
      <td className="px-2 py-2"><select value={row.currency} onChange={(e) => choose({ currency: e.target.value as 'IDR' | 'USD' })} className={field}><option>IDR</option><option>USD</option></select></td>
      <td className="px-2 py-2"><select value={row.cycle} onChange={(e) => choose({ cycle: e.target.value as 'monthly' | 'yearly' })} className={field}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></td>
      <td className="w-20 px-2 py-2"><input type="number" min={1} max={31} value={row.renew_day || ''} onChange={(e) => type({ renew_day: Number(e.target.value) || null })} onBlur={() => persist(row)} placeholder="Day" className={field} title="Day of the month it is charged" /></td>
      <td className="min-w-[110px] px-2 py-2"><input value={row.paid_with || ''} onChange={(e) => type({ paid_with: e.target.value })} onBlur={() => persist(row)} placeholder="Card / bank" className={field} /></td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs font-bold text-[#f5d77f]">{pending ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : rp(monthlyIdr(row, usdRate))}</td>
      <td className="px-2 py-2 text-center"><input type="checkbox" checked={row.active} onChange={(e) => choose({ active: e.target.checked })} title="Still paying for it" className="h-4 w-4 accent-[#d4af37]" /></td>
      <td className="px-2 py-2">
        <button
          type="button" title="Delete"
          onClick={() => {
            if (!row.id) { removed(); return; }
            if (!window.confirm(`Delete ${row.name}?`)) return;
            start(async () => { const res = await deleteSubscription(row.id!); if (!res.success) setError(res.error || 'Could not delete.'); else removed(); });
          }}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
        ><Trash2 className="h-4 w-4" /></button>
      </td>
    </tr>
  );
}

export function SubscriptionsTable({ initial }: { initial: SubscriptionRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Line[]>(initial.map((r) => ({ ...r, _k: r.id })));
  const [usdRate, setUsdRate] = useState(16500);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    try { const v = Number(window.localStorage.getItem('subscriptions-usd-rate')); if (v > 0) setUsdRate(v); } catch { /* storage unavailable */ }
  }, []);
  // The list comes from the server again after "Add the usual list".
  useEffect(() => { setRows((cur) => { const fresh = initial.map((r) => ({ ...r, _k: r.id })); const drafts = cur.filter((c) => !c.id); return [...fresh, ...drafts]; }); }, [initial]);

  const changeRate = (v: number) => {
    setUsdRate(v);
    try { window.localStorage.setItem('subscriptions-usd-rate', String(v)); } catch { /* ignore */ }
  };

  const totals = useMemo(() => {
    const by = new Map<string, number>();
    let month = 0;
    for (const r of rows) { const m = monthlyIdr(r, usdRate); month += m; by.set(r.category, (by.get(r.category) || 0) + m); }
    return { month, by: Array.from(by.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) };
  }, [rows, usdRate]);

  const usual = () => { setError(''); start(async () => { const res = await addUsualSubscriptions(); if (!res.success) setError(res.error || 'Could not add.'); else router.refresh(); }); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="gold-glass-panel rounded-2xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">Per month</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(totals.month)}</div><div className="mt-0.5 text-[10px] text-zinc-500">active ones; a yearly price counts as 1/12</div></div>
        <div className="gold-glass-panel rounded-2xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">Per year</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(totals.month * 12)}</div></div>
        <div className="gold-glass-panel col-span-2 rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">By type (per month)</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{totals.by.length ? totals.by.map(([c, v]) => <span key={c} className="text-zinc-300">{c} <span className="font-mono font-bold text-[#f5d77f]">{rp(v)}</span></span>) : <span className="text-zinc-600">Fill in the prices below.</span>}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setRows((r) => [...r, blank()])} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-white hover:border-[#d4af37]/50"><Plus className="h-3.5 w-3.5" />Add subscription</button>
        <button type="button" onClick={usual} disabled={pending} className="flex items-center gap-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold text-[#d4af37] disabled:opacity-50"><Wand2 className="h-3.5 w-3.5" />Add the usual list</button>
        <label className="ml-auto flex items-center gap-2 text-[11px] text-zinc-400">1 USD = Rp<input type="number" min={1} value={usdRate} onChange={(e) => changeRate(Number(e.target.value))} className={`${field} w-24 text-right font-mono`} /></label>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="gold-glass-panel overflow-x-auto rounded-2xl border border-[#d4af37]/10">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <th className="px-2 py-3">App / tool</th><th className="px-2 py-3">Type</th><th className="px-2 py-3">Plan</th><th className="px-2 py-3 text-right">Price</th><th className="px-2 py-3">Currency</th>
              <th className="px-2 py-3">Billed</th><th className="px-2 py-3">Day</th><th className="px-2 py-3">Paid with</th><th className="px-2 py-3 text-right">Per month</th><th className="px-2 py-3 text-center">Active</th><th />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-zinc-500">Nothing yet. Press &quot;Add the usual list&quot; to start with the apps this ERP uses, then fill in the prices.</td></tr>}
            {rows.map((r) => (
              <Row
                key={r._k} row={r} usdRate={usdRate}
                change={(next) => setRows((all) => all.map((x) => (x._k === r._k ? next : x)))}
                saved={(id) => setRows((all) => all.map((x) => (x._k === r._k ? { ...x, id } : x)))}
                removed={() => setRows((all) => all.filter((x) => x._k !== r._k))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-600">Only you (the founder) can open this page. Every change is saved when you leave the field. The totals use the rate above (kept in this browser); untick Active when you stop paying.</p>
    </div>
  );
}
