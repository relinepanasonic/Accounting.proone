'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setStoreAdvertiser } from '@/app/actions/store-advertiser';
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, AreaChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { PerfAds, PerfTotals, PerfView } from '@/lib/integrations/performance';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const C = { gold: '#d4af37', blue: '#3b82f6', sky: '#60a5fa', pale: '#93c5fd', green: '#10b981', red: '#f87171', zinc: '#71717a' };

const short = (n: number) => {
  const a = Math.abs(n); const s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(1).replace('.', ',')} M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)} rb`;
  return `${s}${Math.round(a)}`;
};
const rp = (n: number) => `Rp ${short(n)}`;
const int = (n: number) => Math.round(n).toLocaleString('id-ID');
const costOf = (t: PerfTotals) => t.ads.gmvMax.cost + t.ads.group.cost + t.ads.independent.cost;
const adSalesOf = (t: PerfTotals) => t.ads.gmvMax.sales + t.ads.group.sales + t.ads.independent.sales;
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

const tip = { contentStyle: { background: '#0e0f14', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, fontSize: 12 } };
const axis = { stroke: '#52525b', fontSize: 10, tickLine: false, axisLine: false } as const;

function Panel({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`gold-glass-panel rounded-2xl border border-[#d4af37]/10 p-5 ${className}`}>
      <h3 className="text-sm font-extrabold text-white">{title}</h3>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'text-white' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="gold-glass-panel rounded-2xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">{label}</div>
      <div className={`mt-1 font-serif text-xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function Funnel({ steps }: { steps: Array<{ name: string; value: number; color: string }> }) {
  const top = Math.max(1, steps[0]?.value || 0);
  return (
    <div className="space-y-2.5">
      {steps.map((s) => (
        <div key={s.name}>
          <div className="mb-1 flex justify-between text-[11px]"><span className="text-zinc-300">{s.name}</span><span className="font-mono text-zinc-400">{int(s.value)} · {((s.value / top) * 100).toFixed(1)}%</span></div>
          <div className="h-3 rounded-full bg-zinc-900"><div className="h-3 rounded-full" style={{ width: `${Math.max(1.5, (s.value / top) * 100)}%`, background: s.color }} /></div>
        </div>
      ))}
    </div>
  );
}

function AdsCard({ title, a, color }: { title: string; a: PerfAds; color: string }) {
  const r = ratio(a.sales, a.cost);
  const cell = (k: string, v: string) => <div><div className="text-[9px] uppercase tracking-wider text-zinc-500">{k}</div><div className="text-xs font-bold text-zinc-100">{v}</div></div>;
  return (
    <div className="gold-glass-panel rounded-2xl border-t-2 p-4" style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">{title}</span><span className={`font-mono text-xs font-bold ${r >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{a.cost > 0 ? `${r.toFixed(2)}x` : '-'}</span></div>
      <div className="mt-1 font-serif text-lg font-bold" style={{ color }}>{rp(a.cost)} <span className="text-[10px] font-normal text-zinc-500">ads cost</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2">{cell('Sales', rp(a.sales))}{cell('View', int(a.views))}{cell('Click', int(a.clicks))}{cell('Order', int(a.orders))}{cell('Item sold', int(a.itemsSold))}{cell('CTR', a.views ? `${((a.clicks / a.views) * 100).toFixed(1)}%` : '-')}</div>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 90, h = 24;
  const pts = values.map((v, i) => `${(i * w) / Math.max(1, values.length - 1)},${h - (v / max) * (h - 2) - 1}`).join(' ');
  return <svg width={w} height={h} aria-hidden="true"><polyline points={pts} fill="none" stroke={C.gold} strokeWidth="1.5" /></svg>;
}

export interface StoreOption { key: string; label: string; source: 'dashboard' | 'reline' }
export interface AdvertiserSummary { id: string; name: string; stores: number; totals: PerfTotals; series: number[] }
interface Person { id: string; name: string }

/** Owners pick the advertiser of a store; the change is saved at once. */
function AdvertiserCell({ storeKey, current, advertisers, canAssign, byHand }: { storeKey: string; current: string; advertisers: Person[]; canAssign: boolean; byHand: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const name = advertisers.find((a) => a.id === value)?.name || '';
  if (!canAssign) return <span className={name ? 'text-zinc-200' : 'text-zinc-600'}>{name || 'Not assigned'}</span>;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value; const prev = value; setValue(next); setError('');
          start(async () => {
            const res = await setStoreAdvertiser(storeKey, next || null);
            if (!res.success) { setValue(prev); setError(res.error || 'Could not save.'); } else router.refresh();
          });
        }}
        className={`rounded-md border bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 focus:outline-none ${byHand ? 'border-[#d4af37]/50' : 'border-zinc-800'}`}
        title={byHand ? 'Set by hand' : name ? 'Matched from the Clients table' : 'Not assigned'}
      >
        <option value="">Not assigned</option>
        {advertisers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {error && <div className="mt-1 max-w-[180px] text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

export function AdvertiserPerformanceDashboard({ view, year, month, storeKey, years, storeOptions, errors, advertiserFilter, advertisers, summaries, assignedTo, teams, canAssign, manualByHand }: {
  view: PerfView; year: number; month: number; storeKey: string; years: number[]; storeOptions: StoreOption[]; errors: string[];
  advertiserFilter: string; advertisers: Person[]; summaries: AdvertiserSummary[]; assignedTo: Record<string, string>; teams: Record<string, { admin: string; sales: string }>; canAssign: boolean; manualByHand: string[]; manualReady: boolean;
}) {
  const router = useRouter();
  const go = (y: number, m: number, st: string, adv: string = advertiserFilter) => router.push(`/productivity/advertiser?year=${y}&month=${m}${adv ? `&advertiser=${encodeURIComponent(adv)}` : ''}${st ? `&store=${encodeURIComponent(st)}` : ''}`);
  const t = view.totals;
  const cost = costOf(t);
  const sel = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-[#d4af37]/60';

  const series = view.labels.map((label, i) => {
    const b = view.buckets[i];
    return {
      name: label, sales: b.sales, gmv: b.gmv, traffic: b.traffic, addToCart: b.addToCart, baseline: b.baselineSales, active: b.activeSales,
      gmvMaxCost: b.ads.gmvMax.cost, groupCost: b.ads.group.cost, independentCost: b.ads.independent.cost,
      gmvMaxSales: b.ads.gmvMax.sales, groupSales: b.ads.group.sales, independentSales: b.ads.independent.sales,
      roas: Number(ratio(adSalesOf(b), costOf(b)).toFixed(2)),
    };
  });
  const hasData = view.stores.length > 0;
  const adsAll: PerfAds = (['gmvMax', 'group', 'independent'] as const).reduce((s, k) => ({
    cost: s.cost + t.ads[k].cost, sales: s.sales + t.ads[k].sales, views: s.views + t.ads[k].views, clicks: s.clicks + t.ads[k].clicks,
    addToCart: s.addToCart + t.ads[k].addToCart, orders: s.orders + t.ads[k].orders, itemsSold: s.itemsSold + t.ads[k].itemsSold,
  }), { cost: 0, sales: 0, views: 0, clicks: 0, addToCart: 0, orders: 0, itemsSold: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => go(Number(e.target.value), month, storeKey)} className={sel} aria-label="Year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={month} onChange={(e) => go(year, Number(e.target.value), storeKey)} className={sel} aria-label="Month">
          <option value={0}>All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={advertiserFilter} onChange={(e) => go(year, month, '', e.target.value)} className={sel} aria-label="Advertiser">
          <option value="">Advertiser: all</option>
          {advertisers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="none">Not assigned</option>
        </select>
        <select value={storeKey} onChange={(e) => go(year, month, e.target.value)} className={`${sel} min-w-[220px]`} aria-label="Store">
          <option value="">Store: all</option>
          <optgroup label="Profesor Dashboard">{storeOptions.filter((s) => s.source === 'dashboard').map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>
          <optgroup label="Reline (dealer)">{storeOptions.filter((s) => s.source === 'reline').map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>
        </select>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          {errors.map((e) => <div key={e}>{e}</div>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Sales" value={rp(t.sales)} sub="Panasonic, ready to ship" />
        <Kpi label="Total GMV" value={rp(t.gmv)} sub="all brands" />
        <Kpi label="Traffic" value={int(t.traffic)} />
        <Kpi label="In-Cart" value={int(t.addToCart)} sub={`${(ratio(t.addToCart, t.traffic) * 100).toFixed(1)}% cart rate`} />
        <Kpi label="Ads Cost" value={rp(cost)} />
        <Kpi label="ROAS" value={cost > 0 ? `${ratio(adSalesOf(t), cost).toFixed(2)}x` : '-'} tone={ratio(adSalesOf(t), cost) >= 1 ? 'text-emerald-400' : 'text-white'} sub="ads sales / ads cost" />
      </div>

      {summaries.length > 0 && (
        <Panel title="Advertiser Job" sub="The stores each advertiser handles and what those stores did in this period. Click a row to filter.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr><th className="px-3 py-2">Advertiser</th><th className="px-3 py-2 text-right">Stores</th><th className="px-3 py-2 text-right">Sales</th><th className="px-3 py-2 text-right">Total GMV</th><th className="px-3 py-2 text-right">Ads Cost</th><th className="px-3 py-2 text-right">ROAS</th><th className="px-3 py-2">Trend</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {summaries.map((a) => {
                  const c = costOf(a.totals); const r = ratio(adSalesOf(a.totals), c);
                  return (
                    <tr key={a.id} onClick={() => go(year, month, '', advertiserFilter === a.id ? '' : a.id)} className={`cursor-pointer hover:bg-zinc-900/40 ${advertiserFilter === a.id ? 'bg-[#d4af37]/10' : ''}`}>
                      <td className={`px-3 py-2 font-semibold ${a.id === 'none' ? 'text-zinc-500' : 'text-white'}`}>{a.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{a.stores}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[#f5d77f]">{rp(a.totals.sales)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{rp(a.totals.gmv)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{rp(c)}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${r >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{c > 0 ? `${r.toFixed(2)}x` : '-'}</td>
                      <td className="px-3 py-2"><Spark values={a.series} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {!hasData ? (
        <div className="gold-glass-panel rounded-2xl p-10 text-center text-sm text-zinc-500">No performance data for this period yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title={month ? 'Weekly Sales' : 'Monthly Sales'} sub="Sales (bars) and Total GMV (line)">
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={short} />
                  <Tooltip {...tip} formatter={(v: any) => rp(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Sales" fill={C.gold} radius={[4, 4, 0, 0]} /><Line dataKey="gmv" name="Total GMV" stroke={C.blue} strokeWidth={2} dot={false} />
                </ComposedChart></ResponsiveContainer></div>
            </Panel>
            <Panel title={month ? 'Weekly Ads Cost' : 'Monthly Ads Cost'} sub="GMV Max Auto, Group Ads and Independent Ads">
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={short} />
                  <Tooltip {...tip} formatter={(v: any) => rp(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="gmvMaxCost" name="GMV Max" stackId="c" fill={C.blue} /><Bar dataKey="groupCost" name="Group" stackId="c" fill={C.sky} /><Bar dataKey="independentCost" name="Independent" stackId="c" fill={C.pale} radius={[4, 4, 0, 0]} />
                </BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Traffic vs Add to Cart" sub="Traffic (bars) and add to cart (line, right)">
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis yAxisId="l" {...axis} tickFormatter={short} /><YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={short} />
                  <Tooltip {...tip} formatter={(v: any) => int(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="traffic" name="Traffic" fill={C.sky} radius={[4, 4, 0, 0]} /><Line yAxisId="r" dataKey="addToCart" name="Add to Cart" stroke={C.gold} strokeWidth={2} dot={false} />
                </ComposedChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Product Funnel" sub="Product views → clicks → add to cart → orders">
              <Funnel steps={[
                { name: 'Product views', value: t.productViews || t.traffic, color: C.blue },
                { name: 'Clicks', value: t.productClicks, color: C.sky },
                { name: 'Add to Cart', value: t.addToCart, color: C.pale },
                { name: 'Orders', value: t.orders, color: C.gold },
              ]} />
            </Panel>
            <Panel title="Baseline vs Active" sub="Sales without the active campaign (baseline) and with it (active)">
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={short} />
                  <Tooltip {...tip} formatter={(v: any) => rp(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area dataKey="baseline" name="Baseline" stroke={C.zinc} fill={C.zinc} fillOpacity={0.15} /><Area dataKey="active" name="Active" stroke={C.green} fill={C.green} fillOpacity={0.2} />
                </AreaChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Sales by Ads Type" sub="Stacked ads sales, ROAS line (right)">
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis yAxisId="l" {...axis} tickFormatter={short} /><YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={(v) => `${v}x`} />
                  <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="gmvMaxSales" name="GMV Max" stackId="s" fill={C.blue} /><Bar yAxisId="l" dataKey="groupSales" name="Group" stackId="s" fill={C.sky} /><Bar yAxisId="l" dataKey="independentSales" name="Independent" stackId="s" fill={C.pale} />
                  <Line yAxisId="r" dataKey="roas" name="ROAS" stroke={C.gold} strokeWidth={2} />
                </ComposedChart></ResponsiveContainer></div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdsCard title="GMV Max Auto" a={t.ads.gmvMax} color={C.blue} />
            <AdsCard title="Group Ads" a={t.ads.group} color={C.sky} />
            <AdsCard title="Independent Ads" a={t.ads.independent} color={C.pale} />
          </div>

          <Panel title="Ads Funnel" sub="All ads: view → click → add to cart → order">
            <Funnel steps={[
              { name: 'View', value: adsAll.views, color: C.blue },
              { name: 'Click', value: adsAll.clicks, color: C.sky },
              { name: 'Add to Cart', value: adsAll.addToCart, color: C.pale },
              { name: 'Order', value: adsAll.orders, color: C.gold },
            ]} />
          </Panel>

          <Panel title="Store Detail" sub="Every store of the period with its team. Link a store to a client in Optimizing > Clients (columns Company and Store).">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-xs">
                <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr><th className="px-3 py-2">Workspace - Store</th><th className="px-3 py-2">Advertiser</th><th className="px-3 py-2">Admin</th><th className="px-3 py-2">Sales</th><th className="px-3 py-2 text-right">Sales</th><th className="px-3 py-2 text-right">Total GMV</th><th className="px-3 py-2 text-right">Traffic</th><th className="px-3 py-2 text-right">In-Cart</th><th className="px-3 py-2 text-right">Ads Cost</th><th className="px-3 py-2 text-right">ROAS</th><th className="px-3 py-2">Trend</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {view.stores.map((s) => {
                    const c = costOf(s.totals); const r = ratio(adSalesOf(s.totals), c);
                    return (
                      <tr key={s.key} onClick={() => go(year, month, s.key === storeKey ? '' : s.key)} className={`cursor-pointer hover:bg-zinc-900/40 ${s.key === storeKey ? 'bg-[#d4af37]/10' : ''}`}>
                        <td className="px-3 py-2 font-semibold text-white">{s.label}</td>
                        <td className="px-3 py-2"><AdvertiserCell storeKey={s.key} current={assignedTo[s.key] || ''} advertisers={advertisers} canAssign={canAssign} byHand={manualByHand.includes(s.key)} /></td>
                        <td className="px-3 py-2 text-zinc-300">{teams[s.key]?.admin || <span className="text-zinc-600">-</span>}</td>
                        <td className="px-3 py-2 text-zinc-300">{teams[s.key]?.sales || <span className="text-zinc-600">-</span>}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[#f5d77f]">{rp(s.totals.sales)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{rp(s.totals.gmv)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{int(s.totals.traffic)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{int(s.totals.addToCart)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">{rp(c)}</td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${r >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{c > 0 ? `${r.toFixed(2)}x` : '-'}</td>
                        <td className="px-3 py-2"><Spark values={s.series} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
