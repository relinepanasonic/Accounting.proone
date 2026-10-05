import React from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, Check, Megaphone, Shield, Sparkles, TrendingUp } from 'lucide-react';
import type { AdminKpi, AdvertisingKpi, PersonKpi, Progress, SalesKpi } from '@/lib/kpi/load';
import { fmtMonthLabel, fmtShort } from '@/lib/kpi/calendar';
import { EndDateEditor, ReportToggle } from '@/components/kpi/KpiControls';
import { rp } from '@/lib/productivity/activity';

const GOLD = '#d4af37';
const pct = (p: Progress) => (p.due > 0 ? Math.min(100, Math.round((p.done / p.due) * 100)) : 0);
const tone = (p: Progress) => (p.due === 0 ? 'zinc' : p.done >= p.due ? 'emerald' : p.done / p.due >= 0.5 ? 'amber' : 'red');
const TONE_HEX: Record<string, string> = { emerald: '#34d399', amber: '#fbbf24', red: '#f87171', zinc: '#52525b' };

// ---------- small building blocks ----------
function Ring({ progress, label, sub, size = 108 }: { progress: Progress; label: string; sub?: string; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = TONE_HEX[tone(progress)];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={9} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * pct(progress)) / 100}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-zinc-100 leading-none">{progress.done}<span className="text-sm text-zinc-500">/{progress.due}</span></span>
          <span className="mt-1 text-[10px] font-bold text-zinc-500">{pct(progress)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">{label}</div>
        {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#d4af37]/15 bg-[#0e0f14] p-5 ${className}`}>{children}</div>;
}

function Section({ icon: Icon, title, sub, children }: { icon: any; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#d4af37]/10 p-2.5 text-[#d4af37]"><Icon className="h-5 w-5" /></div>
        <div>
          <h2 className="font-serif text-lg font-extrabold text-zinc-100">{title}</h2>
          <p className="text-xs text-zinc-500">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Pill({ color, children }: { color: 'emerald' | 'amber' | 'red' | 'zinc'; children: React.ReactNode }) {
  const cls = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
    zinc: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  }[color];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{children}</span>;
}

function Stat({ label, value, hint, color }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: color || '#f4f4f5' }}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-500">{hint}</div>}
    </div>
  );
}

// ---------- advertising ----------
function SalesVsCost({ series }: { series: AdvertisingKpi['series'] }) {
  const W = 640, H = 220, padL = 8, padB = 26, padT = 12;
  const max = Math.max(1, ...series.map((s) => Math.max(s.jual, s.biaya)));
  const bw = (W - padL) / series.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${padL + bw * i + bw / 2},${y(s.biaya)}`).join(' ');
  const any = series.some((s) => s.jual > 0 || s.biaya > 0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sales versus ad cost, last 14 days">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="#27272a" strokeDasharray="3 4" />
        ))}
        {series.map((s, i) => (
          <g key={s.day}>
            <rect x={padL + bw * i + bw * 0.18} y={y(s.jual)} width={bw * 0.64} height={Math.max(0, H - padB - y(s.jual))} rx={3} fill="#10b981" opacity={0.85}>
              <title>{`${fmtShort(s.day)}: sales ${rp(s.jual)}, ad cost ${rp(s.biaya)}, ROAS ${s.roas ? s.roas.toFixed(2) : '-'}`}</title>
            </rect>
            {(i % 2 === 0 || series.length < 8) && (
              <text x={padL + bw * i + bw / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="#71717a">{fmtShort(s.day)}</text>
            )}
          </g>
        ))}
        {any && <path d={line} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round" />}
        {any && series.map((s, i) => <circle key={s.day} cx={padL + bw * i + bw / 2} cy={y(s.biaya)} r={3} fill={GOLD} />)}
      </svg>
      {!any && <p className="py-2 text-center text-xs text-zinc-500">No sessions with sales figures in the last 14 days.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Sales (Penjualan)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: GOLD }} /> Ad cost (Biaya iklan)</span>
      </div>
    </div>
  );
}

function AdvertisingSection({ k, basePath }: { k: AdvertisingKpi; basePath: string }) {
  const totalJual = k.series.reduce((s, x) => s + x.jual, 0);
  const totalBiaya = k.series.reduce((s, x) => s + x.biaya, 0);
  const roas = totalBiaya > 0 ? (totalJual / totalBiaya).toFixed(2) : '-';
  const behind = k.todayRows.filter((r) => r.slots.some((s) => !s));

  return (
    <Section icon={Megaphone} title="Advertising" sub={`${k.clients.length} client${k.clients.length === 1 ? '' : 's'} · ${k.target} sessions per client today${k.special ? ' (twin date / payday)' : ''}`}>
      {k.clients.length === 0 ? (
        <Card><p className="text-sm text-zinc-400">No clients are assigned to you for Advertising yet. Ask the superadmin to assign them.</p></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-around gap-6">
              <Ring progress={k.todayProgress} label="Today" sub={k.special ? '3 sessions each' : '2 sessions each'} size={124} />
              <Ring progress={k.weekProgress} label="This week" sub="Mon until today" />
              <Ring progress={k.monthProgress} label="This month" sub="1st until today" />
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400">Today per client</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {k.todayRows.map(({ client, slots }) => {
                const done = slots.filter(Boolean).length;
                const c = done === slots.length ? 'emerald' : done > 0 ? 'amber' : 'red';
                return (
                  <div key={client.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                    <span className="truncate text-sm font-semibold text-zinc-200">{client.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {slots.map((ok, i) => (
                        <span
                          key={i}
                          title={`Session ${i + 1}${ok ? ' saved' : ' missing'}`}
                          className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}
                        >
                          {ok ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                      ))}
                      <Pill color={c}>{done}/{slots.length}</Pill>
                    </span>
                  </div>
                );
              })}
            </div>
            {behind.length === 0 && <p className="mt-3 text-xs text-emerald-300">All sessions for today are saved.</p>}
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Sales vs ad cost · last 14 days</h3>
                <p className="mt-1 text-[11px] text-zinc-500">Each day uses the last session saved that day.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link href={basePath} scroll={false} className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${k.chartClientId === null ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>All</Link>
                {k.clients.map((c) => (
                  <Link key={c.id} href={`${basePath}?kc=${c.id}`} scroll={false} className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${k.chartClientId === c.id ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>{c.name}</Link>
                ))}
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat label="Sales" value={rp(totalJual)} color="#34d399" />
              <Stat label="Ad cost" value={rp(totalBiaya)} color={GOLD} />
              <Stat label="ROAS" value={roas} />
            </div>
            <SalesVsCost series={k.series} />
          </Card>
        </>
      )}
    </Section>
  );
}

// ---------- admin ----------
function AdminSection({ k }: { k: AdminKpi }) {
  const monthLabel = fmtMonthLabel(`${k.monthLabelKey}-01`);
  return (
    <Section icon={Shield} title="Admin" sub={`${k.rows.length} client${k.rows.length === 1 ? '' : 's'} · 1 Shopee upload per client each week · Monday to Saturday`}>
      {k.rows.length === 0 ? (
        <Card><p className="text-sm text-zinc-400">No clients are assigned to you for Admin yet. Ask the superadmin to assign them.</p></Card>
      ) : (
        <>
          {k.logError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              The upload log from the dashboard app is unavailable ({k.logError}), so uploads cannot be counted right now.
            </div>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-around gap-6">
              <Ring progress={{ done: k.doneToday, due: k.quotaToday }} label="Today" sub={`${k.quotaToday} clients per day`} size={124} />
              <Ring progress={k.weekProgress} label="This week" sub={`${k.workdaysLeft} work day${k.workdaysLeft === 1 ? '' : 's'} left`} />
              <Ring progress={k.reportsProgress} label="Monthly reports" sub={monthLabel} />
            </div>
          </Card>

          {k.doNext.length > 0 && (
            <Card className="border-amber-500/30">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300"><Sparkles className="h-4 w-4" /> Do next today</h3>
              <div className="flex flex-wrap gap-2">
                {k.doNext.map((r) => (
                  <span key={r.client.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
                    {r.client.name}{r.daysSince !== null ? ` · ${r.daysSince}d ago` : ' · never'}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="p-3">Client</th>
                    <th className="p-3">Weekly upload</th>
                    <th className="p-3">Last upload</th>
                    <th className="p-3 text-right">Report {monthLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {k.rows.map((r) => {
                    const stale = r.daysSince === null || r.daysSince >= 5;
                    return (
                      <tr key={r.client.id}>
                        <td className="p-3 font-semibold text-zinc-200">{r.client.name}</td>
                        <td className="p-3">
                          {r.doneThisWeek ? <Pill color="emerald">Done</Pill> : stale ? <Pill color="red">Overdue</Pill> : <Pill color="amber">Due</Pill>}
                          {!r.matched && !k.logError && <span className="ml-2 text-[10px] text-zinc-600">no store match</span>}
                        </td>
                        <td className="p-3 text-zinc-400">{r.lastUpload ? `${fmtShort(r.lastUpload)} (${r.daysSince}d ago)` : 'none in 31 days'}</td>
                        <td className="p-3"><div className="flex justify-end"><ReportToggle clientId={r.client.id} month={k.monthLabelKey} sent={r.reportSent} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Section>
  );
}

// ---------- sales ----------
function SalesSection({ k }: { k: SalesKpi }) {
  const f = k.funnel;
  const steps = [
    { label: 'Leads', value: f.leads, color: '#71717a' },
    { label: 'Warm', value: f.warm, color: '#fbbf24' },
    { label: 'Invoice', value: f.invoices, color: '#60a5fa' },
    { label: 'Closing', value: f.closing, color: '#34d399', hint: `${rp(f.closingValue)} this month` },
  ];
  const top = Math.max(1, ...steps.map((s) => s.value));
  const watch = k.churn.filter((c) => c.state === 'churned' || c.state === 'warning');
  const unset = k.churn.filter((c) => c.state === 'unset');

  return (
    <Section icon={TrendingUp} title="Sales" sub="Funnel, receivables and clients about to leave">
      <Card>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Funnel</h3>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{s.label}</div>
              <div className="h-8 flex-1 overflow-hidden rounded-lg bg-zinc-900">
                <div className="flex h-full items-center rounded-lg px-3 text-sm font-extrabold text-black" style={{ width: `${Math.max(8, (s.value / top) * 100)}%`, background: s.color }}>{s.value}</div>
              </div>
              <div className="hidden w-36 shrink-0 text-[10px] text-zinc-500 sm:block">{s.hint || ''}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">Warm = Contacted, Negotiation. Closing counts deals won this month. Open pipeline: {rp(f.pipelineValue)}{f.lost ? ` · ${f.lost} lost this month` : ''}.</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400">Accounts receivable (A/R)</h3>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Unpaid" value={rp(k.ar.total)} />
            <Stat label="Overdue" value={rp(k.ar.overdue)} color={k.ar.overdue > 0 ? '#f87171' : undefined} />
            <Stat label="Invoices" value={k.ar.count} />
          </div>
          {k.ar.rows.length === 0 ? (
            <p className="text-xs text-emerald-300">Nothing unpaid. </p>
          ) : (
            <div className="divide-y divide-zinc-900 text-xs">
              {k.ar.rows.map((r) => (
                <div key={r.invoice} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0"><div className="truncate font-semibold text-zinc-200">{r.client}</div><div className="font-mono text-[10px] text-zinc-500">{r.invoice}</div></div>
                  <div className="text-right"><div className="font-semibold text-zinc-100">{rp(r.outstanding)}</div>{r.daysLate > 0 ? <Pill color="red">{r.daysLate}d late</Pill> : <Pill color="zinc">not due</Pill>}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400"><AlertTriangle className="h-4 w-4 text-amber-400" /> Near churn</h3>
          <p className="mb-3 text-[11px] text-zinc-500">Warning from 30 days before the service ends; churned from the day after.</p>
          {watch.length === 0 ? (
            <p className="text-xs text-emerald-300">No client is within 30 days of ending.</p>
          ) : (
            <div className="divide-y divide-zinc-900 text-xs">
              {watch.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-zinc-200">{c.name}</div>
                    <div className="mt-0.5">{c.state === 'churned' ? <Pill color="red">Churned {Math.abs(c.days!)}d ago</Pill> : <Pill color="amber">{c.days === 0 ? 'Ends today' : `Ends in ${c.days}d`}</Pill>}</div>
                  </div>
                  <EndDateEditor clientId={c.id} value={c.end} />
                </div>
              ))}
            </div>
          )}
          {unset.length > 0 && (
            <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400"><CalendarClock className="h-3.5 w-3.5" /> {unset.length} without an end date</summary>
              <div className="mt-2 divide-y divide-zinc-900 text-xs">
                {unset.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-2"><span className="truncate text-zinc-300">{c.name}</span><EndDateEditor clientId={c.id} value={c.end} /></div>
                ))}
              </div>
            </details>
          )}
        </Card>
      </div>
    </Section>
  );
}

// ---------- the board ----------
export function KpiBoard({ kpi, basePath, title = 'My KPI' }: { kpi: PersonKpi; basePath: string; title?: string }) {
  return (
    <div className="space-y-10">
      <h1 className="font-serif text-2xl font-extrabold text-zinc-100">{title}</h1>
      {kpi.jobs.length === 0 && (
        <Card><p className="text-sm text-zinc-400">No job is set up yet. The superadmin assigns clients per job under Productivity → Assignments, and your KPI appears here.</p></Card>
      )}
      {kpi.advertising && <AdvertisingSection k={kpi.advertising} basePath={basePath} />}
      {kpi.admin && <AdminSection k={kpi.admin} />}
      {kpi.sales && <SalesSection k={kpi.sales} />}
    </div>
  );
}
