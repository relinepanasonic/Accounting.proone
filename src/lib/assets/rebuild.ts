import { buildSchedule, type ScheduleLine } from '@/lib/assets/schedule';

/**
 * Changing the months (or the salvage value) of an asset rebuilds its whole Schedule Expense from the purchase day, as if the new months had
 * been chosen from the start: the posted months get the new amount (the ledger lines are changed in place), the months beyond the new
 * life are removed from the ledger, and a month that is due but has no ledger line yet is posted.
 *
 * planRebuild is the pure part (what changes); rebuildSchedule applies it.
 */
type Db = any;

export type LineAction = 'keep' | 'update' | 'insert' | 'future';

export interface PlannedLine extends ScheduleLine { month: string; action: LineAction; from: number }
export interface RebuildPlan {
  lines: PlannedLine[];
  /** Months that have ledger lines today but are not in the new schedule: removed. */
  removed: Array<{ month: string; amount: number }>;
  /** Total of the posted depreciation before and after (the book value moves by the difference). */
  before: number;
  after: number;
  changes: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `existing`: month (yyyy-mm) -> the depreciation posted in that month. */
export function planRebuild(input: { purchase: string; months: number; cost: number; salvage: number; today: string; existing: Map<string, number> }): RebuildPlan {
  const target = buildSchedule(input.purchase, input.months, input.cost, input.salvage);
  const inTarget = new Set(target.map((l) => l.due_date.slice(0, 7)));
  const lines: PlannedLine[] = target.map((l) => {
    const month = l.due_date.slice(0, 7);
    const had = input.existing.get(month);
    if (had !== undefined) return { ...l, month, from: had, action: Math.abs(had - l.amount) < 0.5 ? 'keep' : 'update' };
    return { ...l, month, from: 0, action: l.due_date <= input.today ? 'insert' : 'future' };
  });
  const removed = Array.from(input.existing.entries()).filter(([m]) => !inTarget.has(m)).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
  const before = round2(Array.from(input.existing.values()).reduce((s, v) => s + v, 0));
  const after = round2(lines.filter((l) => l.action !== 'future').reduce((s, l) => s + l.amount, 0));
  const changes = removed.length > 0 || lines.some((l) => l.action === 'update' || l.action === 'insert');
  return { lines, removed, before, after, changes };
}

const rp = (n: number) => `Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const label = (m: string) => `${MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Plain words for the confirmation: which months change and what it does to the total. */
export function describePlan(plan: RebuildPlan): string {
  const parts: string[] = [];
  const upd = plan.lines.filter((l) => l.action === 'update');
  if (upd.length) {
    const delta = round2(upd.reduce((s, l) => s + (l.amount - l.from), 0));
    parts.push(`${label(upd[0].month)}${upd.length > 1 ? ` to ${label(upd[upd.length - 1].month)}` : ''}: ${upd.length} month${upd.length === 1 ? '' : 's'} change from ${rp(upd[0].from)} to ${rp(upd[0].amount)} (${delta >= 0 ? '+' : '-'}${rp(delta)})`);
  }
  const ins = plan.lines.filter((l) => l.action === 'insert');
  if (ins.length) parts.push(`${ins.length} month${ins.length === 1 ? '' : 's'} added to the ledger (${ins.map((l) => label(l.month)).join(', ')}): +${rp(ins.reduce((s, l) => s + l.amount, 0))}`);
  if (plan.removed.length) parts.push(`${plan.removed.length} month${plan.removed.length === 1 ? '' : 's'} removed from the ledger (${label(plan.removed[0].month)}${plan.removed.length > 1 ? ` to ${label(plan.removed[plan.removed.length - 1].month)}` : ''}): -${rp(plan.removed.reduce((s, r) => s + r.amount, 0))}`);
  const diff = round2(plan.after - plan.before);
  parts.push(`Total depreciation posted so far: ${rp(plan.before)} becomes ${rp(plan.after)} (${diff >= 0 ? '+' : '-'}${rp(diff)}).`);
  return parts.join('\n');
}

/** The depreciation lines of an asset in the ledger, by month. */
async function readLedger(db: Db, assetId: string) {
  const { data } = await db.from('journal_entries').select('id, transaction_date, debit_amount, credit_amount').eq('reference_id', assetId).eq('reference_type', 'depreciation');
  const byMonth = new Map<string, { debit: any[]; credit: any[] }>();
  for (const j of data || []) {
    const m = String(j.transaction_date).slice(0, 7);
    const g = byMonth.get(m) || { debit: [], credit: [] };
    if (Number(j.debit_amount) > 0) g.debit.push(j); else g.credit.push(j);
    byMonth.set(m, g);
  }
  return byMonth;
}

export interface AssetForRebuild { id: string; workspace_id: string; asset_name: string; initial_value: number; purchase_date: string | null; created_at?: string }

/** What a rebuild would do with these months and salvage value. Reads only. */
export async function previewRebuild(db: Db, asset: AssetForRebuild, months: number, salvage: number, today: string): Promise<RebuildPlan> {
  const ledger = await readLedger(db, asset.id);
  const existing = new Map<string, number>();
  for (const [m, g] of ledger) existing.set(m, round2(g.debit.reduce((s, j) => s + Number(j.debit_amount), 0)));
  const purchase = String(asset.purchase_date || asset.created_at || today).slice(0, 10);
  return planRebuild({ purchase, months, cost: Number(asset.initial_value || 0), salvage, today, existing });
}

/** Applies the rebuild: ledger lines changed in place, the schedule table made again. Needs a client that may change journal_entries (the admin client). */
export async function rebuildSchedule(db: Db, asset: AssetForRebuild, months: number, salvage: number, today: string): Promise<{ ok: boolean; error?: string; plan?: RebuildPlan }> {
  const plan = await previewRebuild(db, asset, months, salvage, today);
  const total = plan.lines.length;
  const description = (seq: number) => `Asset schedule ${seq}/${total} - ${asset.asset_name}`;
  const ledger = await readLedger(db, asset.id);

  const { data: maps } = await db.from('workspace_mappings').select('mapping_type, account_code').eq('workspace_id', asset.workspace_id);
  const expense = (maps || []).find((m: any) => m.mapping_type === 'DEPRECIATION_EXPENSE')?.account_code || '6100';
  const accumulated = (maps || []).find((m: any) => m.mapping_type === 'ACCUMULATED_DEPRECIATION')?.account_code || '1202';

  const { data: oldSchedule } = await db.from('asset_schedule').select('seq, posted_at').eq('asset_id', asset.id);
  const postedAtOf = new Map<number, string>((oldSchedule || []).filter((l: any) => l.posted_at).map((l: any) => [Number(l.seq), String(l.posted_at)] as [number, string]));
  const nowIso = new Date().toISOString();

  // 1. months that leave the schedule: out of the ledger
  const gone = plan.removed.flatMap((r) => { const g = ledger.get(r.month); return g ? [...g.debit, ...g.credit].map((j) => j.id) : []; });
  if (gone.length) {
    const { error } = await db.from('journal_entries').delete().in('id', gone);
    if (error) return { ok: false, error: error.message };
  }

  for (const l of plan.lines) {
    const g = ledger.get(l.month);
    if (g && (g.debit.length || g.credit.length)) {
      // 2. months that stay: the amount and the number change in place (a doubled month keeps one pair)
      const extra = [...g.debit.slice(1), ...g.credit.slice(1)].map((j) => j.id);
      if (extra.length) await db.from('journal_entries').delete().in('id', extra);
      if (g.debit[0]) { const { error } = await db.from('journal_entries').update({ debit_amount: l.amount, credit_amount: 0, description: description(l.seq) }).eq('id', g.debit[0].id); if (error) return { ok: false, error: error.message }; }
      if (g.credit[0]) { const { error } = await db.from('journal_entries').update({ debit_amount: 0, credit_amount: l.amount, description: description(l.seq) }).eq('id', g.credit[0].id); if (error) return { ok: false, error: error.message }; }
    } else if (l.action === 'insert') {
      // 3. a month that is due and has no ledger line yet
      const { error } = await db.from('journal_entries').insert([
        { workspace_id: asset.workspace_id, account_code: expense, transaction_date: l.due_date, debit_amount: l.amount, credit_amount: 0, description: description(l.seq), reference_id: asset.id, reference_type: 'depreciation' },
        { workspace_id: asset.workspace_id, account_code: accumulated, transaction_date: l.due_date, debit_amount: 0, credit_amount: l.amount, description: description(l.seq), reference_id: asset.id, reference_type: 'depreciation' },
      ]);
      if (error) return { ok: false, error: error.message };
    }
  }

  // 4. the schedule table follows
  const { error: delErr } = await db.from('asset_schedule').delete().eq('asset_id', asset.id);
  if (delErr) return { ok: false, error: delErr.message };
  const rows = plan.lines.map((l) => ({ workspace_id: asset.workspace_id, asset_id: asset.id, seq: l.seq, due_date: l.due_date, amount: l.amount, posted_at: l.action === 'future' ? null : postedAtOf.get(l.seq) || nowIso }));
  if (rows.length) {
    const { error } = await db.from('asset_schedule').insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, plan };
}
