import { buildSchedule, monthsOf, spread, type ScheduleLine } from '@/lib/assets/schedule';

/**
 * Keeps the Schedule Expense of the fixed assets in step with the assets and with the ledger:
 *  1. an asset without a schedule gets one (months from its useful life, cost minus salvage, from its purchase day);
 *  2. an asset that was edited (months, cost or salvage) gets its UNPOSTED payments re-spread; posted ones never change;
 *  3. every payment that is due (due date today or earlier) and not posted yet is posted: Dr depreciation expense / Cr accumulated depreciation.
 * Months that the old month-end engine already depreciated (journal lines of type "depreciation") are marked posted, not posted again.
 * Safe to run any number of times (a payment is claimed before it is posted).
 */
type Db = any;

export interface SyncResult { ok: boolean; created: number; posted: number; error?: string }

const todayJakarta = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const MISSING = 'Run supabase/migrations/20261025_asset_schedule.sql in Supabase first.';

export async function syncAssetSchedules(db: Db, opts: { workspaceId?: string; assetId?: string } = {}): Promise<SyncResult> {
  let q = db.from('fixed_assets').select('id, workspace_id, asset_name, initial_value, salvage_value, purchase_date, created_at, useful_life_years, status').ilike('status', 'active');
  if (opts.workspaceId) q = q.eq('workspace_id', opts.workspaceId);
  if (opts.assetId) q = q.eq('id', opts.assetId);
  const { data: assets, error: aErr } = await q;
  if (aErr) return { ok: false, created: 0, posted: 0, error: aErr.message };
  if (!assets || assets.length === 0) return { ok: true, created: 0, posted: 0 };

  const ids = assets.map((a: any) => a.id);
  const { data: existing, error: sErr } = await db.from('asset_schedule').select('id, asset_id, seq, due_date, amount, posted_at').in('asset_id', ids).order('seq', { ascending: true });
  if (sErr) return { ok: false, created: 0, posted: 0, error: /asset_schedule|42P01|PGRST205/.test(`${sErr.code} ${sErr.message}`) ? MISSING : sErr.message };

  // Months that the old engine already depreciated.
  const { data: legacy } = await db.from('journal_entries').select('reference_id, transaction_date').eq('reference_type', 'depreciation').in('reference_id', ids).gt('debit_amount', 0);
  const legacyMonths = new Map<string, Set<string>>();
  for (const l of legacy || []) (legacyMonths.get(l.reference_id) || legacyMonths.set(l.reference_id, new Set()).get(l.reference_id)!).add(String(l.transaction_date).slice(0, 7));

  const mappings = new Map<string, { expense: string; accumulated: string }>();
  const accountsOf = async (workspaceId: string) => {
    if (!mappings.has(workspaceId)) {
      const { data } = await db.from('workspace_mappings').select('mapping_type, account_code').eq('workspace_id', workspaceId);
      mappings.set(workspaceId, {
        expense: (data || []).find((m: any) => m.mapping_type === 'DEPRECIATION_EXPENSE')?.account_code || '6100',
        accumulated: (data || []).find((m: any) => m.mapping_type === 'ACCUMULATED_DEPRECIATION')?.account_code || '1202',
      });
    }
    return mappings.get(workspaceId)!;
  };

  const today = todayJakarta();
  const nowIso = new Date().toISOString();
  let created = 0;
  let posted = 0;

  for (const asset of assets) {
    const purchase = String(asset.purchase_date || asset.created_at || today).slice(0, 10);
    const months = monthsOf(asset.useful_life_years);
    const base = Math.max(0, Number(asset.initial_value || 0) - Number(asset.salvage_value || 0));
    let lines: Array<{ id?: string; seq: number; due_date: string; amount: number; posted_at: string | null }> = (existing || []).filter((l: any) => l.asset_id === asset.id).map((l: any) => ({ ...l, amount: Number(l.amount) }));

    const row = (l: ScheduleLine, postedAt: string | null) => ({ workspace_id: asset.workspace_id, asset_id: asset.id, seq: l.seq, due_date: l.due_date, amount: l.amount, posted_at: postedAt });

    if (lines.length === 0) {
      const fresh = buildSchedule(purchase, months, Number(asset.initial_value || 0), Number(asset.salvage_value || 0));
      const done = legacyMonths.get(asset.id);
      const rows = fresh.map((l) => row(l, done?.has(l.due_date.slice(0, 7)) ? nowIso : null));
      if (rows.length) {
        const { error } = await db.from('asset_schedule').insert(rows);
        if (error) return { ok: false, created, posted, error: error.message };
        created += rows.length;
      }
    } else {
      // Edited asset: the posted payments stay; the rest is spread again over the months that are left.
      const postedLines = lines.filter((l) => l.posted_at);
      const open = lines.filter((l) => !l.posted_at);
      const postedSum = Math.round(postedLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
      const remaining = Math.max(0, Math.round((base - postedSum) * 100) / 100);
      const remainingCount = Math.max(0, months - postedLines.length);
      const openSum = Math.round(open.reduce((s, l) => s + l.amount, 0) * 100) / 100;
      const changed = open.length !== remainingCount || Math.abs(openSum - remaining) > 0.5;
      if (changed) {
        if (open.length) {
          const { error } = await db.from('asset_schedule').delete().in('id', open.map((l) => l.id));
          if (error) return { ok: false, created, posted, error: error.message };
        }
        const next = remainingCount > 0 && remaining > 0 ? spread(purchase, remaining, remainingCount, postedLines.length + 1) : [];
        if (next.length) {
          const { error } = await db.from('asset_schedule').insert(next.map((l) => row(l, null)));
          if (error) return { ok: false, created, posted, error: error.message };
          created += next.length;
        }
      }
    }
  }

  // Post what is due.
  const { data: due, error: dErr } = await db.from('asset_schedule').select('id, workspace_id, asset_id, seq, due_date, amount').in('asset_id', ids).is('posted_at', null).lte('due_date', today).order('due_date', { ascending: true });
  if (dErr) return { ok: false, created, posted, error: dErr.message };
  for (const l of due || []) {
    const asset = assets.find((a: any) => a.id === l.asset_id);
    if (!asset || !(Number(l.amount) > 0)) continue;
    // Claim the payment first: a second run at the same time cannot post it twice.
    const { data: claimed } = await db.from('asset_schedule').update({ posted_at: nowIso }).eq('id', l.id).is('posted_at', null).select('id');
    if (!claimed || claimed.length === 0) continue;
    const total = monthsOf(asset.useful_life_years);
    const description = `Asset schedule ${l.seq}/${total} - ${asset.asset_name}`;
    const accounts = await accountsOf(l.workspace_id);
    const { error } = await db.from('journal_entries').insert([
      { workspace_id: l.workspace_id, account_code: accounts.expense, transaction_date: l.due_date, debit_amount: Number(l.amount), credit_amount: 0, description, reference_id: l.asset_id, reference_type: 'depreciation' },
      { workspace_id: l.workspace_id, account_code: accounts.accumulated, transaction_date: l.due_date, debit_amount: 0, credit_amount: Number(l.amount), description, reference_id: l.asset_id, reference_type: 'depreciation' },
    ]);
    if (error) {
      await db.from('asset_schedule').update({ posted_at: null }).eq('id', l.id);
      return { ok: false, created, posted, error: error.message };
    }
    posted++;
  }
  return { ok: true, created, posted };
}
