'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check } from 'lucide-react';
import { createFixedAsset } from '@/app/actions/fixed-assets';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { DatePickerUI } from '@/components/ui/DatePickerUI';

const input = 'w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all font-sans text-sm';
const label = 'text-[10px] font-bold tracking-widest text-[#d4af37] uppercase';
const rp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/** Add a fixed asset by hand: its Schedule Expense is made at once, and it waits in Bank Reconcile > Cash Paid for the bank payment. */
export function NewAssetForm({ categories, today }: { categories: Array<{ code: string; name: string }>; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0] ? `${categories[0].code} - ${categories[0].name}` : '');
  const [date, setDate] = useState(today);
  const [cost, setCost] = useState<number | ''>('');
  const [months, setMonths] = useState<number>(12);
  const [salvage, setSalvage] = useState<number | ''>(0);
  const [error, setError] = useState('');

  const base = Math.max(0, Number(cost || 0) - Number(salvage || 0));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('The asset name is required.');
    if (!(Number(cost) > 0)) return setError('The purchase cost must be more than 0.');
    if (months < 1) return setError('The months must be at least 1.');
    start(async () => {
      const res = await createFixedAsset({ asset_name: name.trim(), category, purchase_date: date, initial_value: Number(cost), salvage_value: Number(salvage || 0), months });
      if (!res.success) { setError(res.error || 'Could not save the asset.'); return; }
      router.push('/assets');
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="gold-glass-panel space-y-6 rounded-2xl p-6 sm:p-8">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" /><p className="text-sm text-red-300">{error}</p></div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><label className={label}>Asset name</label><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Nico | Kulkas Puan" className={input} /></div>
        <div className="space-y-2">
          <label className={label}>Category (asset account)</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {categories.map((c) => <option key={c.code} value={`${c.code} - ${c.name}`}>{c.code} - {c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2"><label className={label}>Purchase date</label><DatePickerUI value={date} onChange={setDate} required /></div>
        <div className="space-y-2"><label className={label}>Purchase cost (Rp)</label><RupiahInput value={cost} onValueChange={setCost} className={input} placeholder="0" /></div>
        <div className="space-y-2"><label className={label}>Useful life (months)</label><input type="number" min={1} step={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} className={input} /></div>
        <div className="space-y-2">
          <label className={label}>Salvage value (Rp)</label><RupiahInput value={salvage} onValueChange={setSalvage} className={input} placeholder="0" />
          <p className="text-[10px] text-zinc-500">Estimated resale value at the end of its life (often 0).</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/20 p-4">
        <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Schedule Expense</p><p className="font-mono text-sm text-[#d4af37]">{months > 0 ? `${months} payments of ${rp(base / months)}` : '-'}</p></div>
        <div className="text-right text-[10px] leading-relaxed text-zinc-500">One payment on the {date ? Number(date.slice(8, 10)) : '-'}th of each month.<br />Months that are already past are posted at once.</div>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500">The purchase itself waits in <span className="text-zinc-300">Bank Reconcile &gt; Cash Paid</span>: match it with the bank line that paid for the asset.</p>

      <div className="flex items-center justify-end gap-4 border-t border-zinc-800 pt-6">
        <Link href="/assets" className="text-xs font-bold uppercase tracking-widest text-zinc-400 transition-colors hover:text-white">Cancel</Link>
        <button type="submit" disabled={pending} className="gold-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider disabled:opacity-60"><Check className="h-4 w-4" />{pending ? 'Saving...' : 'Add asset'}</button>
      </div>
    </form>
  );
}
