import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { assignedClientIds } from '@/lib/assignments/server';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { FakeOrderTable } from '@/components/productivity/FakeOrderTable';
import type { FakeOrderRow } from '@/app/actions/fake-orders';

export const dynamic = 'force-dynamic';

/** Admin > Fake Order: per client of the Fake Order project: No Fake Order, buyer name, total and proof. */
export default async function AdminFakeOrderPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, role } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: userData } = await supabase.auth.getUser();

  const [ordersRes, clientsRes, linesRes] = await Promise.all([
    supabase.from('fake_orders').select('id, client_id, client_name, order_no, buyer_name, total, proof_url, created_at').eq('workspace_id', activeWorkspaceId).order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').eq('workspace_id', activeWorkspaceId).or('contact_type.eq.client,contact_type.is.null').order('name'),
    supabase.from('invoice_line_items').select('invoice_id').or('package_name.ilike.%fake%,description.ilike.%fake%').limit(2000),
  ]);
  const migrationMissing = Boolean(ordersRes.error);

  // The clients that have an invoice for the Fake Order project (a line named "Fake ...") come first.
  const invoiceIds = Array.from(new Set((linesRes.data || []).map((l: any) => l.invoice_id).filter(Boolean)));
  const fakeClientIds = new Set<string>();
  for (let i = 0; i < invoiceIds.length; i += 200) {
    const { data } = await supabase.from('invoices').select('client_id').eq('workspace_id', activeWorkspaceId).eq('is_quotation', false).in('id', invoiceIds.slice(i, i + 200));
    (data || []).forEach((r: any) => r.client_id && fakeClientIds.add(r.client_id));
  }

  let clients = (clientsRes.data || []) as Array<{ id: string; name: string }>;
  if (role !== 'superadmin' && role !== 'founder') {
    const assigned = await assignedClientIds(supabase, activeWorkspaceId, userData.user?.id, 'admin');
    clients = clients.filter((c) => assigned.has(c.id));
  }

  const rows: FakeOrderRow[] = (ordersRes.data || []).map((r: any) => ({
    id: r.id, clientId: r.client_id, clientName: r.client_name || '', orderNo: r.order_no || '', buyerName: r.buyer_name || '',
    total: Number(r.total || 0), proofUrl: r.proof_url || '', createdAt: r.created_at,
  }));

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/admin" active="fake" />
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><ShieldAlert className="w-8 h-8" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Fake Order</h1>
          <p className="text-sm text-zinc-400 mt-1">The fake orders made for each client of the Fake Order project, with the proof</p>
        </div>
      </div>
      <FakeOrderTable rows={rows} clients={clients.map((c) => ({ ...c, hasInvoice: fakeClientIds.has(c.id) }))} migrationMissing={migrationMissing} />
    </div>
  );
}
