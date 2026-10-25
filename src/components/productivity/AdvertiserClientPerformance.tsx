'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveContainer, ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const C = { gold: '#d4af37', green: '#10b981', red: '#f87171' };

const short = (n: number) => {
  const a = Math.abs(n); const s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(1).replace('.', ',')} M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)} rb`;
  return `${s}${Math.round(a)}`;
};
const rp = (n: number) => `Rp ${short(n)}`;
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const x = (r: number, cost: number) => (cost > 0 ? `${r.toFixed(2)}x` : '-');

const tip = { contentStyle: { background: '#0e0f14', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, fontSize: 11 } };
const axis = { stroke: '#52525b', fontSize: 9, tickLine: false, axisLine: false } as const;

export interface ClientCard {
  key: string;
  /** The client linked to the store, else the store name. */
  name: string;
  /** "Company - Store". */
  label: string;
  advertiser: string;
  labels: string[];
  gmv: number[];
  cost: number[];
  adSales: number[];
  totals: { gmv: number; cost: number; adSales: number };
}
interface Option { key: string; label: string }

/** One box of a client: a chart and its numbers per period underneath. */
function Box({ title, sub, chart, rows, labels }: { title: string; sub: string; chart: React.ReactNode; rows: Array<{ name: string; color: string; values: string[] }>; labels: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-extrabold text-white">{title}</span><span className="text-[10px] text-zinc-500">{sub}</span></div>
      <div className="mt-2 h-36">{chart}</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead><tr className="text-zinc-500"><th className="py-1 pr-2 text-left font-bold" />{labels.map((l) => <th key={l} className="px-1.5 py-1 text-right font-bold">{l}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-zinc-900">
                <td className="whitespace-nowrap py-1 pr-2 font-bold" style={{ color: r.color }}>{r.name}</td>
                {r.values.map((v, i) => <td key={i} className="whitespace-nowrap px-1.5 py-1 text-right font-mono text-zinc-300">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ c }: { c: ClientCard }) {
  const roas = ratio(c.totals.adSales, c.totals.cost);
  const data = c.labels.map((name, i) => ({ name, gmv: c.gmv[i], cost: c.cost[i], roas: Number(ratio(c.adSales[i], c.cost[i]).toFixed(2)) }));
  return (
    <div className="gold-glass-panel rounded-2xl border border-[#d4af37]/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-white">{c.name}</div>
          <div className="truncate text-[11px] text-zinc-500">{c.label}{c.advertiser ? ` · ${c.advertiser}` : ' · Not assigned'}</div>
        </div>
        <div className="flex gap-4 text-right">
          <div><div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">GMV</div><div className="font-mono text-xs font-bold text-emerald-400">{rp(c.totals.gmv)}</div></div>
          <div><div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Ads Cost</div><div className="font-mono text-xs font-bold text-red-400">{rp(c.totals.cost)}</div></div>
          <div><div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">ROAS</div><div className="font-mono text-xs font-bold text-[#d4af37]">{x(roas, c.totals.cost)}</div></div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Box
          title="GMV" sub="per period" labels={c.labels}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={short} width={42} />
                <Tooltip {...tip} formatter={(v: any) => rp(Number(v))} />
                <Area dataKey="gmv" name="GMV" stroke={C.green} fill={C.green} fillOpacity={0.2} dot={data.length === 1} />
              </AreaChart>
            </ResponsiveContainer>
          }
          rows={[{ name: 'GMV', color: C.green, values: c.gmv.map(short) }]}
        />
        <Box
          title="Ads Cost vs ROAS" sub="ads sales / ads cost" labels={c.labels}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} />
                <YAxis yAxisId="l" {...axis} tickFormatter={short} width={42} /><YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={(v) => `${v}x`} width={32} />
                <Tooltip {...tip} formatter={(v: any, n: any) => (n === 'ROAS' ? `${v}x` : rp(Number(v)))} />
                <Bar yAxisId="l" dataKey="cost" name="Ads Cost" fill={C.red} radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" dataKey="roas" name="ROAS" stroke={C.gold} strokeWidth={2} dot={data.length === 1} />
              </ComposedChart>
            </ResponsiveContainer>
          }
          rows={[
            { name: 'Ads Cost', color: C.red, values: c.cost.map(short) },
            { name: 'ROAS', color: C.gold, values: c.cost.map((v, i) => x(ratio(c.adSales[i], v), v)) },
          ]}
        />
      </div>
    </div>
  );
}

/** Advertiser > Performance: every client (store) with its GMV box and its Ads Cost vs ROAS box, sorted by name. */
export function AdvertiserClientPerformance({ cards, year, month, week, years, advertiserFilter, advertisers, showAdvertiser, storeKey, storeOptions, errors }: {
  cards: ClientCard[]; year: number; month: number; week: number; years: number[];
  advertiserFilter: string; advertisers: Option[]; showAdvertiser: boolean; storeKey: string; storeOptions: Option[]; errors: string[];
}) {
  const router = useRouter();
  const go = (p: { y?: number; m?: number; w?: number; adv?: string; st?: string }) => {
    const y = p.y ?? year; const m = p.m ?? month; const w = m ? p.w ?? week : 0; const adv = p.adv ?? advertiserFilter; const st = p.st ?? storeKey;
    router.push(`/productivity/advertiser/performance?year=${y}&month=${m}${w ? `&week=${w}` : ''}${adv ? `&advertiser=${encodeURIComponent(adv)}` : ''}${st ? `&store=${encodeURIComponent(st)}` : ''}`);
  };
  const sel = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-[#d4af37]/60 disabled:opacity-40';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => go({ y: Number(e.target.value) })} className={sel} aria-label="Year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={month} onChange={(e) => go({ m: Number(e.target.value), w: 0 })} className={sel} aria-label="Month">
          <option value={0}>All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={week} onChange={(e) => go({ w: Number(e.target.value) })} disabled={!month} className={sel} aria-label="Week" title={month ? '' : 'Pick a month first'}>
          <option value={0}>All weeks</option>
          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>W{w}</option>)}
        </select>
        {showAdvertiser && (
          <select value={advertiserFilter} onChange={(e) => go({ adv: e.target.value, st: '' })} className={sel} aria-label="Advertiser">
            <option value="">Advertiser: all</option>
            {advertisers.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            <option value="none">Not assigned</option>
          </select>
        )}
        <select value={storeKey} onChange={(e) => go({ st: e.target.value })} className={`${sel} min-w-[220px]`} aria-label="Store">
          <option value="">Store: all</option>
          {storeOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">{errors.map((e) => <div key={e}>{e}</div>)}</div>
      )}

      {cards.length === 0
        ? <div className="gold-glass-panel rounded-2xl p-8 text-center text-sm text-zinc-500">No store numbers in this period.</div>
        : <div className="space-y-4">{cards.map((c) => <Card key={c.key} c={c} />)}</div>}
    </div>
  );
}
