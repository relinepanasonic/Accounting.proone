import React from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, Clock, Megaphone, Shield, TrendingUp } from 'lucide-react';
import {
  fmtDateTime,
  fmtDay,
  fmtTime,
  rp,
  type PersonActivity,
  type RangeKey,
  type UnlinkedActivity,
} from '@/lib/productivity/activity';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

const ROLE_STYLE: Record<string, string> = {
  superadmin: 'bg-[#d4af37]/20 border-[#d4af37] text-[#f5d77f]',
  accounting: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
  admin: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
  advertiser: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
  founder: 'bg-[#d4af37]/30 border-[#d4af37] text-[#f5d77f]',
};

export function RangeTabs({ basePath, range }: { basePath: string; range: RangeKey }) {
  return (
    <div className="inline-flex rounded-xl border border-zinc-800 overflow-hidden text-[11px] font-bold uppercase tracking-wider">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={`${basePath}?range=${r.key}`}
          className={`px-4 py-2 ${range === r.key ? 'bg-[#d4af37] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${ROLE_STYLE[role] || 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
      {role}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0e0f14] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-2xl font-extrabold text-zinc-100 font-mono">{value}</div>
      {hint && <div className="text-[10px] text-zinc-600 mt-0.5">{hint}</div>}
    </div>
  );
}

const advSummary = (a: PersonActivity) => {
  if (a.advertiser.length === 0) return null;
  const clients = new Set(a.advertiser.map((e) => e.client)).size;
  const days = new Set(a.advertiser.map((e) => e.date)).size;
  return `${a.advertiser.length} session${a.advertiser.length === 1 ? '' : 's'} · ${clients} client${clients === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'}`;
};
const salesSummary = (a: PersonActivity) => {
  if (a.sales.length === 0) return null;
  const won = a.sales.filter((s) => s.kind === 'won');
  return `${a.sales.length} deal${a.sales.length === 1 ? '' : 's'} touched${won.length ? ` · ${won.length} won (${rp(won.reduce((s, d) => s + d.value, 0))})` : ''}`;
};
const adminSummary = (a: PersonActivity) => {
  if (a.admin.length === 0) return null;
  const days = new Set(a.admin.map((e) => e.at.slice(0, 10))).size;
  return `${a.admin.length} upload${a.admin.length === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'}`;
};

const Dash = () => <span className="text-zinc-700">-</span>;

/** Superadmin / founder: the whole team. */
export function TeamOverview({
  activities,
  range,
  rangeLabel,
  salesUnlinked,
  adminUnlinked,
  adminLogError,
}: {
  activities: PersonActivity[];
  range: RangeKey;
  rangeLabel: string;
  salesUnlinked: UnlinkedActivity[];
  adminUnlinked: UnlinkedActivity[];
  adminLogError: string | null;
}) {
  const active = activities.filter((a) => a.lastActive).length;
  const sessions = activities.reduce((n, a) => n + a.advertiser.length, 0);
  const deals = activities.reduce((n, a) => n + a.sales.length, 0) + salesUnlinked.reduce((n, u) => n + u.count, 0);
  const uploads = activities.reduce((n, a) => n + a.admin.length, 0) + adminUnlinked.reduce((n, u) => n + u.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">{rangeLabel} · Jakarta time</div>
        <RangeTabs basePath="/productivity" range={range} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="People with activity" value={`${active}/${activities.length}`} />
        <Stat label="Ad sessions saved" value={sessions} />
        <Stat label="Deals touched" value={deals} />
        <Stat label="Admin uploads" value={uploads} hint="from the dashboard app" />
      </div>

      <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="p-3">Person</th>
                <th className="p-3"><Megaphone className="inline w-3 h-3 mr-1" />Advertising</th>
                <th className="p-3"><TrendingUp className="inline w-3 h-3 mr-1" />Sales</th>
                <th className="p-3"><Shield className="inline w-3 h-3 mr-1" />Admin</th>
                <th className="p-3"><Clock className="inline w-3 h-3 mr-1" />Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {activities.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No staff in this workspace yet.</td></tr>
              )}
              {activities.map((a) => (
                <tr key={a.person.userId} className="hover:bg-zinc-900/40">
                  <td className="p-3">
                    <Link href={`/productivity/person/${a.person.userId}?range=${range}`} className="font-bold text-zinc-100 hover:text-[#f5d77f]">
                      {a.person.name}
                    </Link>
                    <div className="mt-0.5"><RoleBadge role={a.person.role} /></div>
                  </td>
                  <td className="p-3 text-zinc-300">{advSummary(a) || <Dash />}</td>
                  <td className="p-3 text-zinc-300">{salesSummary(a) || <Dash />}</td>
                  <td className="p-3 text-zinc-300">{adminSummary(a) || <Dash />}</td>
                  <td className="p-3 font-mono text-zinc-400">{fmtDateTime(a.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(salesUnlinked.length > 0 || adminUnlinked.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { title: 'Salespeople not matched to an ERP user', rows: salesUnlinked, unit: 'deals' },
            { title: 'Dashboard admins not matched to an ERP user', rows: adminUnlinked, unit: 'uploads' },
          ]
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <div key={g.title} className="rounded-2xl border border-zinc-800 bg-[#0e0f14] p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-2">{g.title}</h3>
                <div className="divide-y divide-zinc-900 text-xs">
                  {g.rows.map((r) => (
                    <div key={r.name} className="py-1.5 flex items-center justify-between gap-3">
                      <span className="capitalize text-zinc-200">{r.name}</span>
                      <span className="text-zinc-400">{r.count} {r.count === 1 ? g.unit.replace(/s$/, '') : g.unit}</span>
                      <span className="font-mono text-zinc-500">{fmtDateTime(r.lastActive)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-zinc-600">These names exist in the sales or dashboard data but do not match anyone's name here. Use the same name in both places to link them.</p>
              </div>
            ))}
        </div>
      )}

      {adminLogError && <p className="text-[11px] text-amber-400">Admin uploads unavailable: {adminLogError}</p>}
      <p className="text-[11px] text-zinc-600">
        Shows what was recorded, not targets: what counts as "done" for each division will be added later. Accounting actions are not tracked per person yet.
      </p>
    </div>
  );
}

function Section({ title, summary, children }: { title: string; summary: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0e0f14] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
        <span className="text-[11px] text-[#f5d77f]">{summary || 'nothing recorded'}</span>
      </div>
      {children}
    </div>
  );
}

/** One person's own activity: used for "My productivity" and for a superadmin opening someone. */
export function PersonDetail({
  activity,
  range,
  rangeLabel,
  basePath,
  backHref,
  adminLogError,
}: {
  activity: PersonActivity;
  range: RangeKey;
  rangeLabel: string;
  basePath: string;
  backHref?: string;
  adminLogError: string | null;
}) {
  const { person, advertiser, sales, admin } = activity;

  // Advertiser sessions grouped by the day they are for.
  const days = Array.from(new Set(advertiser.map((e) => e.date))).sort().reverse();
  const nothing = advertiser.length + sales.length + admin.length === 0;

  return (
    <div className="space-y-6">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#f5d77f]">
          <ArrowLeft className="w-4 h-4" /> Whole team
        </Link>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><Activity className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-extrabold text-zinc-100">{person.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <RoleBadge role={person.role} />
              <span className="text-[11px] text-zinc-500">{rangeLabel} · last activity {fmtDateTime(activity.lastActive)}</span>
            </div>
          </div>
        </div>
        <RangeTabs basePath={basePath} range={range} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Ad sessions" value={advertiser.length} hint={advSummary(activity) ? undefined : 'none in this period'} />
        <Stat label="Clients covered" value={new Set(advertiser.map((e) => e.client)).size} />
        <Stat label="Deals touched" value={sales.length} hint={`${sales.filter((s) => s.kind === 'won').length} won`} />
        <Stat label="Admin uploads" value={admin.length} />
      </div>

      {nothing && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          Nothing recorded for this period. Advertising sessions, sales deals and dashboard uploads are tracked; accounting actions are not tracked per person yet.
        </div>
      )}

      {(advertiser.length > 0 || person.role === 'advertiser') && (
        <Section title="Advertising sessions" summary={advSummary(activity)}>
          {days.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500">No sessions saved in this period.</div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {days.map((day) => (
                <div key={day} className="px-4 py-3 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-28 shrink-0 text-xs font-bold text-zinc-200">{fmtDay(day)}</div>
                  <div className="flex flex-wrap gap-2">
                    {advertiser
                      .filter((e) => e.date === day)
                      .sort((x, y) => x.client.localeCompare(y.client) || x.session - y.session)
                      .map((e, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-[11px] rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                          <span className="font-bold">Sesi {e.session}</span>
                          <span className="text-zinc-300">{e.client}</span>
                          <span className="font-mono text-zinc-500">{fmtTime(e.at)}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {(sales.length > 0 || person.role === 'accounting') && (
        <Section title="Sales deals" summary={salesSummary(activity)}>
          {sales.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500">No deals created or moved in this period.</div>
          ) : (
            <div className="divide-y divide-zinc-900 text-xs">
              {sales.map((s, i) => (
                <div key={i} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${s.kind === 'won' ? 'border-emerald-500/40 text-emerald-300' : s.kind === 'new' ? 'border-sky-500/40 text-sky-300' : 'border-zinc-700 text-zinc-400'}`}>
                    {s.kind === 'won' ? 'won' : s.kind === 'new' ? 'new lead' : 'moved'}
                  </span>
                  <span className="text-zinc-100 font-medium">{s.title}</span>
                  <span className="text-zinc-500">{s.stage}</span>
                  <span className="text-[#f5d77f] font-mono">{rp(s.value)}</span>
                  <span className="ml-auto font-mono text-zinc-600">{fmtDateTime(s.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {(admin.length > 0 || person.role === 'admin') && (
        <Section title="Admin uploads (dashboard app)" summary={adminSummary(activity)}>
          {admin.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500">
              {adminLogError ? `Unavailable: ${adminLogError}` : 'No uploads in this period (matched by your name in the dashboard app).'}
            </div>
          ) : (
            <div className="divide-y divide-zinc-900 text-xs">
              {[...admin].sort((a, b) => b.at.localeCompare(a.at)).map((u, i) => (
                <div key={i} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-zinc-500 w-28">{fmtDateTime(u.at)}</span>
                  <span className="text-zinc-200">{u.type}</span>
                  <span className="text-[#f5d77f]">{u.store}</span>
                  {u.files > 0 && <span className="text-zinc-600">{u.files} file(s)</span>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
