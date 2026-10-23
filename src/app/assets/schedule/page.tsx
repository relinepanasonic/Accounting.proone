import React, { Suspense } from 'react';
import { CalendarClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { AssetTabs } from '@/components/assets/AssetTabs';
import { ScheduleSync } from '@/components/assets/ScheduleSync';
import { ScheduleTable, type ScheduleRow } from '@/components/assets/ScheduleTable';
import { monthsOf } from '@/lib/assets/schedule';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const todayJakarta = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

async function Schedule() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const today = todayJakarta();

  const { data: assets } = await supabase.from('fixed_assets').select('id, asset_name, useful_life_years').eq('workspace_id', activeWorkspaceId);
  const { data: lines, error } = await supabase
    .from('asset_schedule')
    .select('id, asset_id, seq, due_date, amount, posted_at')
    .eq('workspace_id', activeWorkspaceId)
    .order('due_date', { ascending: true })
    .limit(5000);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
        The Schedule Expense table is not there yet. Run <code className="font-mono">supabase/migrations/20261025_asset_schedule.sql</code> in the Supabase SQL editor, then reload this page.
      </div>
    );
  }

  const nameOf = new Map((assets || []).map((a: any) => [a.id, a.asset_name as string]));
  const totalOf = new Map((assets || []).map((a: any) => [a.id, monthsOf(a.useful_life_years)]));
  const rows: ScheduleRow[] = (lines || []).map((l: any) => ({
    id: l.id,
    assetId: l.asset_id,
    asset: nameOf.get(l.asset_id) || 'Asset',
    seq: l.seq,
    total: totalOf.get(l.asset_id) || l.seq,
    dueDate: String(l.due_date).slice(0, 10),
    amount: Number(l.amount),
    posted: Boolean(l.posted_at),
  }));

  const thisMonth = today.slice(0, 7);
  const postedThisMonth = rows.filter((r) => r.posted && r.dueDate.slice(0, 7) === thisMonth).reduce((s, r) => s + r.amount, 0);
  const upcoming = rows.filter((r) => !r.posted);
  const upcomingTotal = upcoming.reduce((s, r) => s + r.amount, 0);
  const next = upcoming[0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Posted this month</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(postedThisMonth)}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Still to come</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(upcomingTotal)}</div><div className="text-[10px] text-zinc-500">{upcoming.length} payment{upcoming.length === 1 ? '' : 's'}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Next payment</div><div className="mt-1 font-serif text-xl font-bold text-white">{next ? rp(next.amount) : '-'}</div><div className="text-[10px] text-zinc-500">{next ? `${next.asset} on ${next.dueDate}` : 'Nothing scheduled'}</div></div>
      </div>
      <ScheduleTable rows={rows} today={today} />
    </div>
  );
}

export default function AssetSchedulePage() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-8 lg:px-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#d4af37]/20 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white">
            <CalendarClock className="h-5 w-5 text-[#d4af37]" />
            <span>Schedule Expense</span>
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Each asset is spread over the months you chose until it is 0: one payment on the purchase day of every month. The first payment is posted at once, the others on their day.
          </p>
        </div>
        <ScheduleSync />
      </div>
      <AssetTabs active="schedule" />
      <Suspense fallback={<div className="gold-glass-panel h-64 animate-pulse rounded-2xl" />}>
        <Schedule />
      </Suspense>
    </div>
  );
}
