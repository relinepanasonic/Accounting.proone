// The main payment of a fixed asset: the expense line that bought it. Its Schedule Expense follows the reconcile state of that payment.
type Db = any;

/** Inserts the asset and remembers its main payment. Before 20261029_asset_source_transaction.sql is run the asset is still made, only without the link. */
export async function insertAssetWithSource(db: Db, row: Record<string, unknown>, sourceTransactionId: string | null) {
  if (sourceTransactionId) {
    const first = await db.from('fixed_assets').insert({ ...row, source_transaction_id: sourceTransactionId }).select('id').single();
    if (!first.error) return first;
    if (!(first.error.code === '42703' || first.error.code === 'PGRST204' || /source_transaction_id/.test(first.error.message))) return first;
  }
  return db.from('fixed_assets').insert(row).select('id').single();
}

/**
 * Is the main payment of each asset reconciled with the bank? The linked payment when there is one; else an expense of the same
 * amount in an asset account (12xx) of the same workspace (assets made before the link existed). Returns asset id -> its payment.
 */
export function mainPaymentOf(
  assets: Array<{ id: string; initial_value: number; source_transaction_id?: string | null }>,
  transactions: Array<{ id: string; amount: number; category: string | null; reconciled: boolean | null; bank_reference: string | null }>,
): Map<string, { id: string; matched: boolean }> {
  const out = new Map<string, { id: string; matched: boolean }>();
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const isMatched = (t: { reconciled: boolean | null; bank_reference: string | null }) => Boolean(t.reconciled && String(t.bank_reference || '').startsWith('BANK-REF:'));
  for (const a of assets) {
    const linked = a.source_transaction_id ? byId.get(a.source_transaction_id) : undefined;
    if (linked) { out.set(a.id, { id: linked.id, matched: isMatched(linked) }); continue; }
    const same = transactions.filter((t) => Number(t.amount) === Number(a.initial_value) && /^\s*1/.test(String(t.category || '')));
    if (!same.length) continue;
    const pick = same.find(isMatched) || same[0];
    out.set(a.id, { id: pick.id, matched: isMatched(pick) });
  }
  return out;
}
