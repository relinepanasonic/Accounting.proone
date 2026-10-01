import React from 'react';
import Link from 'next/link';
import { Megaphone, Shield, TrendingUp } from 'lucide-react';
import type { PersonKpi, Progress } from '@/lib/kpi/load';
import type { Person } from '@/lib/productivity/activity';
import { rp } from '@/lib/productivity/activity';

const HEX = { emerald: '#34d399', amber: '#fbbf24', red: '#f87171', zinc: '#52525b' };
const toneOf = (p: Progress): keyof typeof HEX => (p.due === 0 ? 'zinc' : p.done >= p.due ? 'emerald' : p.done / p.due >= 0.5 ? 'amber' : 'red');
const ratio = (p: Progress) => (p.due > 0 ? p.done / p.due : 1);

function Bar({ label, p }: { label: string; p: Progress }) {
  const w = p.due > 0 ? Math.min(100, Math.round((p.done / p.due) * 100)) : 0;
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="font-mono font-bold" style={{ color: HEX[toneOf(p)] }}>{p.done}/{p.due}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: HEX[toneOf(p)] }} />
      </div>
    </div>
  );
}

function Flag({ color, children }: { color: 'red' | 'amber' | 'emerald' | 'zinc'; children: React.ReactNode }) {
  const cls = {
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    zinc: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  }[color];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
}

/** How far behind a person is (0 = on track, 1 = nothing done), so the people who need attention come first. */
function behind(k: PersonKpi): number {
  const parts: number[] = [];
  if (k.advertising && k.advertising.clients.length) parts.push(1 - ratio(k.advertising.todayProgress));
  if (k.admin && k.admin.rows.length) parts.push(1 - ratio(k.admin.weekProgress));
  if (k.sales) parts.push(k.sales.churn.some((c) => c.state === 'churned') || k.sales.ar.overdue > 0 ? 0.5 : 0);
  return parts.length ? Math.max(...parts) : -1;
}

/** Owner view: one row per person with their KPI progress for today / this week / this month. */
export function KpiScoreboard({ rows }: { rows: { person: Person; kpi: PersonKpi }[] }) {
  const sorted = [...rows].sort((a, b) => behind(b.kpi) - behind(a.kpi));
  const withJobs = sorted.filter((r) => r.kpi.jobs.length > 0);
  const without = sorted.filter((r) => r.kpi.jobs.length === 0);

  return (
    <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white">KPI progress</h2>
        <span className="text-[11px] text-zinc-500">Furthest behind is on top · click a name for the full KPI</span>
      </div>

      {withJobs.length === 0 ? (
        <p className="p-6 text-sm text-zinc-400">
          No KPI yet: nobody has clients assigned. Assign clients per job under <Link href="/productivity/assignments" className="text-[#f5d77f] underline">Assignments</Link>.
        </p>
      ) : (
        <div className="divide-y divide-zinc-900">
          {withJobs.map(({ person, kpi }) => {
            const churned = kpi.sales ? kpi.sales.churn.filter((c) => c.state === 'churned').length : 0;
            const warning = kpi.sales ? kpi.sales.churn.filter((c) => c.state === 'warning').length : 0;
            return (
              <div key={person.userId} className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[180px_1fr]">
                <div>
                  <Link href={`/productivity/person/${person.userId}`} className="font-bold text-zinc-100 hover:text-[#f5d77f]">{person.name}</Link>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">{person.role}</div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {kpi.advertising && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"><Megaphone className="h-3 w-3" /> Advertising</div>
                      {kpi.advertising.clients.length === 0 ? (
                        <Flag color="zinc">no clients</Flag>
                      ) : (
                        <>
                          <Bar label="Today" p={kpi.advertising.todayProgress} />
                          <Bar label="Week" p={kpi.advertising.weekProgress} />
                          <Bar label="Month" p={kpi.advertising.monthProgress} />
                        </>
                      )}
                    </div>
                  )}
                  {kpi.admin && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"><Shield className="h-3 w-3" /> Admin</div>
                      {kpi.admin.rows.length === 0 ? (
                        <Flag color="zinc">no clients</Flag>
                      ) : (
                        <>
                          <Bar label="Uploads today" p={{ done: kpi.admin.doneToday, due: kpi.admin.quotaToday }} />
                          <Bar label="Uploads week" p={kpi.admin.weekProgress} />
                          <Bar label="Reports month" p={kpi.admin.reportsProgress} />
                        </>
                      )}
                    </div>
                  )}
                  {kpi.sales && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"><TrendingUp className="h-3 w-3" /> Sales</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Flag color="zinc">{kpi.sales.funnel.leads} leads</Flag>
                        <Flag color="amber">{kpi.sales.funnel.warm} warm</Flag>
                        <Flag color="zinc">{kpi.sales.funnel.invoices} invoice</Flag>
                        <Flag color="emerald">{kpi.sales.funnel.closing} closed</Flag>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Flag color={kpi.sales.ar.overdue > 0 ? 'red' : 'emerald'}>{kpi.sales.ar.overdue > 0 ? `overdue ${rp(kpi.sales.ar.overdue)}` : 'A/R on time'}</Flag>
                        {churned > 0 && <Flag color="red">{churned} churned</Flag>}
                        {warning > 0 && <Flag color="amber">{warning} near churn</Flag>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {without.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-3 text-[11px] text-zinc-500">
          No job assigned yet: {without.map((r) => r.person.name).join(', ')}
        </div>
      )}
    </div>
  );
}
