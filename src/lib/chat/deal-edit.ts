import { createAdminClient } from '@/lib/api/supabase-admin';
import { forget } from './cache';
import { cleanDealEdit, dealCode, deleteBlock, mayEditDeal } from './deal-edit-rules';
import { deleteBareProspect } from './junk-leads';

/**
 * Manual edit and delete of a lead from the pipeline board (the same deal and client the ERP shows). A real client (not a prospect) keeps its name and phone:
 * invoices and reports depend on them, so only the store, the PIC, the address, the notes, the value and the title change.
 */
type Who = { userId: string; name: string; role?: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

async function load(ws: string, dealId: string) {
  const db = createAdminClient();
  const { data: deal } = await db.from('crm_deals').select('id, title, value, notes, stage, client_id, salesman_id, invoice_id, paid_at').eq('id', dealId).eq('workspace_id', ws).maybeSingle();
  if (!deal) return null;
  const clientId = (deal as any).client_id as string | null;
  const { data: client } = clientId ? await db.from('clients').select('id, name, store_name, contact_name, phone, billing_address, is_prospect').eq('id', clientId).maybeSingle() : { data: null };
  return { deal: deal as any, client: (client || null) as any };
}

export async function getDealDetail(ws: string, dealId: string) {
  const r = await load(ws, dealId);
  if (!r) return fail(404, 'Lead not found.');
  const { deal, client } = r;
  return {
    id: deal.id as string, code: dealCode(deal.id), stage: deal.stage as string, title: String(deal.title || ''), value: Number(deal.value || 0), notes: String(deal.notes || ''),
    name: String(client?.name || ''), store: String(client?.store_name || ''), pic: String(client?.contact_name || ''), phone: String(client?.phone || ''), address: String(client?.billing_address || ''),
    realClient: !!client && client.is_prospect === false,
  };
}

export async function editDeal(ws: string, dealId: string, input: unknown, by: Who): Promise<{ ok: true } | Fail> {
  const r = await load(ws, dealId);
  if (!r) return fail(404, 'Lead not found.');
  const may = mayEditDeal(by.role || '', by.userId, r.deal);
  if (!may.ok) return fail(403, may.error);
  const c = cleanDealEdit(input);
  if (!c.ok) return fail(400, c.error);
  const v = c.value;
  const db = createAdminClient();
  const now = new Date().toISOString();
  if (r.client) {
    const patch: Record<string, unknown> = { store_name: v.store, contact_name: v.pic, billing_address: v.address, updated_at: now };
    if (r.client.is_prospect) { patch.name = v.name; patch.phone = v.phone; }          // a real client keeps its name and phone
    const { error } = await db.from('clients').update(patch).eq('id', r.client.id);
    if (error) return fail(500, error.message);
    forget(`clients:${ws}`);
  }
  const { error: dErr } = await db.from('crm_deals').update({ title: v.title, value: v.value, notes: v.notes, ...(r.client?.is_prospect !== false ? { lead_name: v.name } : {}), updated_at: now }).eq('id', dealId);
  return dErr ? fail(500, dErr.message) : { ok: true };
}

export async function deleteDeal(ws: string, dealId: string, by: Who): Promise<{ ok: true; clientDeleted: boolean } | Fail> {
  const r = await load(ws, dealId);
  if (!r) return fail(404, 'Lead not found.');
  const may = mayEditDeal(by.role || '', by.userId, r.deal);
  if (!may.ok) return fail(403, may.error);
  const db = createAdminClient();
  const [{ count: reqs }, { count: projs }] = await Promise.all([
    db.from('invoice_requests').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
    db.from('projects').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
  ]);
  const block = deleteBlock(r.deal, reqs ?? 0, projs ?? 0);
  if (block) return fail(409, block);
  const { error } = await db.from('crm_deals').delete().eq('id', dealId);
  if (error) return fail(500, error.message);
  const clientDeleted = r.client ? await deleteBareProspect(r.client.id) : false;
  forget(`clients:${ws}`);
  return { ok: true, clientDeleted };
}
