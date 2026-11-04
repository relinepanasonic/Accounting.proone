'use client';

import React, { useMemo, useState } from 'react';
import type { ClientCard } from '@/components/productivity/AdvertiserClientPerformance';

const MONTH_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const short = (n: number) => {
  const a = Math.abs(n); const s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(1).replace('.', ',')} M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)} rb`;
  return `${s}${Math.round(a)}`;
};
const rp = (n: number) => `Rp ${short(n)}`;
const x = (sales: number, cost: number) => (cost > 0 ? `${(sales / cost).toFixed(2)}x` : '-');
const COMPANY = /^(ProOne|Reline|Alpha|Lighting Solution)\s+-\s+(.*)$/i;

interface Row { key: string; advertiser: string; year: string; month: string; week: string; company: string; store: string; client: string; gmv: number; cost: number; adSales: number }

/** What a column of the chart means as Year / Month / Week, from its label and the period that is shown. */
function whenOf(label: string, year: number, month: number): { year: string; month: string; week: string } {
  if (/^W\d$/.test(label)) return { year: String(year), month: MONTH_FULL[month - 1] || '-', week: label };
  const week = /^(\d{2}) (\w{3}) (\d{4})$/.exec(label); // the first day of a week, in a short range
  if (week) { const mi = MON.indexOf(week[2]); return { year: week[3], month: MONTH_FULL[mi] || week[2], week: `${week[1]} ${week[2]}` }; }
  const mYY = /^(\w{3}) (\d{2})$/.exec(label); // a month of a long range
  if (mYY) { const mi = MON.indexOf(mYY[1]); return { year: `20${mYY[2]}`, month: MONTH_FULL[mi] || mYY[1], week: '-' }; }
  const mi = MON.indexOf(label);
  return { year: String(year), month: mi >= 0 ? MONTH_FULL[mi] : label, week: '-' };
}

/** The clients in one table before their charts: Advertiser | Year | Month | Week | Company | Store | GMV | Ads Cost | ROAS. Total per client, or one line per month / week. */
export function ClientSummaryTable({ cards, year, month, rangeLabel }: { cards: ClientCard[]; year: number; month: number; rangeLabel: string | null }) {
  const [mode, setMode] = useState<'total' | 'period'>('total');
  const [sort, setSort] = useState<{ key: 'store' | 'advertiser' | 'gmv' | 'cost' | 'roas'; asc: boolean }>({ key: 'store', asc: true });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const c of cards) {
      const m = COMPANY.exec(c.label);
      const base = { advertiser: c.advertiser || 'Not assigned', company: m ? m[1] : '-', store: m ? m[2] : c.label, client: c.name };
      if (mode === 'total') {
        out.push({ key: c.key, ...base, year: rangeLabel ? '-' : String(year), month: rangeLabel ? rangeLabel : month ? MONTH_FULL[month - 1] : 'Semua bulan', week: month && !rangeLabel ? 'Semua minggu' : '-', gmv: c.totals.gmv, cost: c.totals.cost, adSales: c.totals.adSales });
      } else {
        c.labels.forEach((label, i) => {
          if (!c.gmv[i] && !c.cost[i] && !c.adSales[i]) return;
          const w = whenOf(label, year, month);
          out.push({ key: `${c.key}-${label}`, ...base, ...w, gmv: c.gmv[i], cost: c.cost[i], adSales: c.adSales[i] });
        });
      }
    }
    return out;
  }, [cards, mode, year, month, rangeLabel]);

  const sorted = useMemo(() => {
    const val = (r: Row) => (sort.key === 'store' ? r.store.toLowerCase() : sort.key === 'advertiser' ? r.advertiser.toLowerCase() : sort.key === 'gmv' ? r.gmv : sort.key === 'cost' ? r.cost : r.cost > 0 ? r.adSales / r.cost : -1);
    return [...rows].sort((a, b) => {
      const p = val(a), q = val(b);
      return (typeof p === 'number' && typeof q === 'number' ? p - q : String(p).localeCompare(String(q))) * (sort.asc ? 1 : -1);
    });
  }, [rows, sort]);

  const total = rows.reduce((t, r) => ({ gmv: t.gmv + r.gmv, cost: t.cost + r.cost, adSales: t.adSales + r.adSales }), { gmv: 0, cost: 0, adSales: 0 });
  const th = (key: typeof sort.key, label: string, right = false) => (
    <th className={`px-3 py-2 ${right ? 'text-right' : ''}`}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === 'store' || key === 'advertiser' }))} className={`inline-flex items-center gap-1 uppercase hover:text-zinc-200 ${sort.key === key ? 'text-[#f5d77f]' : ''}`}>{label}<span className="text-[8px]">{sort.key === key ? (sort.asc ? '▲' : '▼') : ''}</span></button>
    </th>
  );

  return (
    <div className="gold-glass-panel rounded-2xl border border-[#d4af37]/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-white">Clients</h2>
          <p className="text-[10px] text-zinc-500">{rows.length} line{rows.length === 1 ? '' : 's'} · the charts of each client follow below</p>
        </div>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
          {([['total', 'Total per client'], ['period', rangeLabel || month ? 'Per week / period' : 'Per month']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${mode === k ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-800/60">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>{th('advertiser', 'Advertiser')}<th className="px-3 py-2">Year</th><th className="px-3 py-2">Month</th><th className="px-3 py-2">Week</th><th className="px-3 py-2">Company</th>{th('store', 'Store')}{th('gmv', 'GMV', true)}{th('cost', 'Ads Cost', true)}{th('roas', 'ROAS', true)}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sorted.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-zinc-500">No numbers in this period.</td></tr>}
            {sorted.map((r) => (
              <tr key={r.key} className="hover:bg-zinc-900/40">
                <td className={`whitespace-nowrap px-3 py-2 ${r.advertiser === 'Not assigned' ? 'text-zinc-600' : 'text-zinc-300'}`}>{r.advertiser}</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{r.year}</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{r.month}</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{r.week}</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-300">{r.company}</td>
                <td className="px-3 py-2 font-semibold text-white">{r.store}{r.client && r.client !== r.store && <div className="text-[10px] font-normal text-zinc-500">{r.client}</div>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-emerald-400">{rp(r.gmv)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-red-400">{rp(r.cost)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[#d4af37]">{x(r.adSales, r.cost)}</td>
              </tr>
            ))}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="sticky bottom-0 border-t border-zinc-700 bg-zinc-950 text-xs font-extrabold">
              <tr><td colSpan={6} className="px-3 py-2 text-zinc-300">Total</td><td className="px-3 py-2 text-right font-mono text-emerald-400">{rp(total.gmv)}</td><td className="px-3 py-2 text-right font-mono text-red-400">{rp(total.cost)}</td><td className="px-3 py-2 text-right font-mono text-[#d4af37]">{x(total.adSales, total.cost)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
