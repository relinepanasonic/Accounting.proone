// A product belongs to exactly one workspace (1:1). So an invoice of PT Pintu belongs to the workspace whose catalog its products come from.
// Server-side only.
import { PT_WORKSPACE_ID } from '@/lib/workspaces/known';

type Db = any;

/** The workspace that owns the invoice's products (by name, biggest amount wins), or null when nothing matches. PT Pintu is never the answer. */
export async function workspaceFromCatalog(db: Db, lines: { package_name?: string | null; description?: string | null; amount?: number | null; unit_price?: number | null; quantity?: number | null }[]): Promise<string | null> {
  if (!lines.length) return null;
  const { data: products } = await db.from('products').select('name, workspace_id');
  const owner = new Map<string, string>();
  for (const p of products || []) {
    if (p.workspace_id && p.workspace_id !== PT_WORKSPACE_ID) owner.set(String(p.name).trim().toLowerCase(), p.workspace_id);
  }
  const weight = new Map<string, number>();
  for (const l of lines) {
    const key = String(l.package_name || '').trim().toLowerCase() || String(l.description || '').split('\n')[0].trim().toLowerCase();
    const ws = owner.get(key);
    if (!ws) continue;
    const amt = Number(l.amount ?? Number(l.unit_price || 0) * Number(l.quantity || 1)) || 1;
    weight.set(ws, (weight.get(ws) || 0) + amt);
  }
  let best: string | null = null;
  let bestW = -1;
  for (const [ws, w] of weight) if (w > bestW) { best = ws; bestW = w; }
  return best;
}

/** PT invoice with no workspace yet: take it from the catalog. Never overwrites a workspace somebody picked. */
export async function autoAssignFromCatalog(db: Db, invoiceId: string, invoiceWorkspaceId: string): Promise<string | null> {
  if (invoiceWorkspaceId !== PT_WORKSPACE_ID) return null;
  const { data: inv } = await db.from('invoices').select('assigned_workspace_id').eq('id', invoiceId).maybeSingle();
  if (!inv || inv.assigned_workspace_id) return null;
  const { data: lines } = await db.from('invoice_line_items').select('package_name, description, quantity, unit_price').eq('invoice_id', invoiceId);
  const ws = await workspaceFromCatalog(db, lines || []);
  if (!ws) return null;
  await db.from('invoices').update({ assigned_workspace_id: ws }).eq('id', invoiceId);
  return ws;
}
