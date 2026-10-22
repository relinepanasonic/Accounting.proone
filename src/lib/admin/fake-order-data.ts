import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { assignedClientIds } from '@/lib/assignments/server';
import { invoiceScope } from '@/lib/sales/client-table';
import type { FakeOrderProject, FakeOrderRow } from '@/app/actions/fake-orders';

/** The products of the fake order project: Friends Order and Paket Optimize Shopee New Store. */
export const FAKE_ORDER_PRODUCT = /friends order|new store/i;

export interface ProjectCandidate { invoiceId: string; clientId: string; clientName: string; invoiceNumber: string; issueDate: string; productName: string }

/** Everything the Fake Order pages show. mode: active projects or finished ones. */
export async function loadFakeOrderBoard(mode: 'active' | 'finished') {
  const supabase = await createClient();
  const { activeWorkspaceId, role } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: userData } = await supabase.auth.getUser();
  const admin = createAdminClient();

  // Projects of this mode. Without the 20261017 migration the table is missing: the page says so.
  let q = supabase.from('fake_order_projects').select('id, client_id, client_name, invoice_id, invoice_number, product_name, start_date, finished_at').eq('workspace_id', activeWorkspaceId).order('start_date', { ascending: false });
  q = mode === 'active' ? q.is('finished_at', null) : q.not('finished_at', 'is', null);
  const projectsRes = await q;
  const migrationMissing = Boolean(projectsRes.error);
  const projects: FakeOrderProject[] = (projectsRes.data || []).map((p: any) => ({
    id: p.id, clientId: p.client_id, clientName: p.client_name || '', invoiceId: p.invoice_id, invoiceNumber: p.invoice_number || '',
    productName: p.product_name || '', startDate: String(p.start_date).slice(0, 10), finishedAt: p.finished_at ? String(p.finished_at).slice(0, 10) : null,
  }));

  let orders: FakeOrderRow[] = [];
  if (projects.length > 0) {
    const orderQuery = (cols: string) => supabase.from('fake_orders').select(cols).eq('workspace_id', activeWorkspaceId).in('project_id', projects.map((p) => p.id)).order('created_at', { ascending: false });
    // proof_review_url needs the 20261018 migration; without it the orders still show.
    let { data, error } = (await orderQuery('id, project_id, client_id, client_name, order_no, buyer_name, total, proof_url, proof_review_url, created_at')) as any;
    if (error) ({ data } = (await orderQuery('id, project_id, client_id, client_name, order_no, buyer_name, total, proof_url, created_at')) as any);
    orders = (data || []).map((r: any) => ({ id: r.id, projectId: r.project_id, clientId: r.client_id, clientName: r.client_name || '', orderNo: r.order_no || '', buyerName: r.buyer_name || '', total: Number(r.total || 0), proofUrl: r.proof_url || '', proofReviewUrl: r.proof_review_url || '', createdAt: r.created_at }));
  }

  // Invoices of Prof and of PT Pintu (assigned to this company) with Friends Order or Paket Optimize Shopee New Store, not started yet.
  const candidates: ProjectCandidate[] = [];
  if (mode === 'active' && !migrationMissing) {
    const { data: lines } = await admin.from('invoice_line_items').select('invoice_id, package_name').or('package_name.ilike.%friends order%,package_name.ilike.%new store%').limit(3000);
    const matching = (lines || []).filter((l: any) => l.invoice_id && FAKE_ORDER_PRODUCT.test(String(l.package_name || '')));
    const ids = Array.from(new Set(matching.map((l: any) => l.invoice_id as string)));
    const invoices = new Map<string, any>();
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await admin.from('invoices').select('id, invoice_number, issue_date, status, client_id, clients(name)').or(invoiceScope(activeWorkspaceId)).eq('is_quotation', false).not('client_id', 'is', null).in('id', ids.slice(i, i + 150));
      (data || []).forEach((inv: any) => invoices.set(inv.id, inv));
    }

    let allowedClients: Set<string> | null = null;
    if (role !== 'superadmin' && role !== 'founder') allowedClients = await assignedClientIds(supabase, activeWorkspaceId, userData.user?.id, 'admin');

    const { data: usedRows } = await supabase.from('fake_order_projects').select('invoice_id, product_name').eq('workspace_id', activeWorkspaceId);
    const used = new Set((usedRows || []).map((u: any) => `${u.invoice_id}|${u.product_name}`));
    const seen = new Set<string>();
    for (const l of matching as any[]) {
      const inv = invoices.get(l.invoice_id);
      if (!inv || ['cancelled', 'draft'].includes(String(inv.status || '').toLowerCase())) continue;
      if (allowedClients && !allowedClients.has(inv.client_id)) continue;
      const key = `${inv.id}|${l.package_name}`;
      if (used.has(key) || seen.has(key)) continue;
      seen.add(key);
      const client: any = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      candidates.push({ invoiceId: inv.id, clientId: inv.client_id, clientName: client?.name || 'Client', invoiceNumber: inv.invoice_number || '', issueDate: String(inv.issue_date || '').slice(0, 10), productName: l.package_name });
    }
    candidates.sort((a, b) => a.clientName.localeCompare(b.clientName) || b.issueDate.localeCompare(a.issueDate));
  }

  return { projects, orders, candidates, migrationMissing };
}
