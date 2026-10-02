import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Inbox, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { requestTotal, type RequestItem } from '@/lib/sales/flow';

export const dynamic = 'force-dynamic';

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export default async function InvoiceRequestsPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!FINANCE_ROLES.includes(ctx.role)) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Invoice requests are for Accounting.</p>
      </div>
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('invoice_requests')
    .select('id, deal_id, client_id, requested_by_name, items, note, status, invoice_id, requested_at, generated_at')
    .eq('workspace_id', ctx.activeWorkspaceId)
    .neq('status', 'cancelled')
    .order('requested_at', { ascending: false })
    .limit(80);

  const rows = data || [];
  const clientIds = Array.from(new Set(rows.map((r: any) => r.client_id)));
  const invoiceIds = rows.map((r: any) => r.invoice_id).filter(Boolean);
  const [{ data: clients }, { data: invoices }] = await Promise.all([
    clientIds.length ? db.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
    invoiceIds.length ? db.from('invoices').select('id, invoice_number').in('id', invoiceIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const clientName = new Map<string, string>((clients || []).map((c: any) => [c.id, c.name]));
  const invoiceNo = new Map<string, string>((invoices || []).map((i: any) => [i.id, i.invoice_number]));

  const open = rows.filter((r: any) => r.status === 'requested');
  const done = rows.filter((r: any) => r.status === 'generated');

  const Card = ({ r, isOpen }: { r: any; isOpen: boolean }) => {
    const items = (r.items || []) as RequestItem[];
    return (
      <div className={`rounded-2xl border bg-[#0e0f14] p-4 ${isOpen ? 'border-[#d4af37]/40' : 'border-zinc-800'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-zinc-100">{clientName.get(r.client_id) || 'Client'}</div>
            <div className="text-xs text-zinc-500">From {r.requested_by_name || 'Sales'} · requested {stamp(r.requested_at)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-bold text-[#f5d77f]">{rp(requestTotal(items))}</div>
            {!isOpen && <div className="text-[11px] text-emerald-300">{invoiceNo.get(r.invoice_id) || 'Invoice'} · made {stamp(r.generated_at)}</div>}
          </div>
        </div>
        <table className="mt-3 w-full text-xs">
          <tbody className="divide-y divide-zinc-900 text-zinc-300">
            {items.map((it, i) => (
              <tr key={i}>
                <td className="py-1.5">{it.name}</td>
                <td className="py-1.5 text-right text-zinc-500">{it.quantity} × {rp(it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.note && <p className="mt-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">Note: {r.note}</p>}
        {isOpen && (
          <Link href={`/invoices/new?request=${r.id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:opacity-90">
            <FileText className="h-4 w-4" /> Create invoice
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-6">
      <div className="flex items-center gap-3 border-b border-[#d4af37]/20 pb-4">
        <Link href="/invoices" className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><Inbox className="h-5 w-5 text-[#d4af37]" /> Invoice requests</h1>
          <p className="text-xs text-zinc-500">Salesmen ask for an invoice here. Create it and the salesman is told.</p>
        </div>
      </div>

      {error && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">Run <span className="font-mono">supabase/migrations/20261003_sales_flow.sql</span> in Supabase first.</p>}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Waiting ({open.length})</h2>
        {open.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No request is waiting.</p>}
        {open.map((r: any) => <Card key={r.id} r={r} isOpen />)}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Done ({done.length})</h2>
          {done.map((r: any) => <Card key={r.id} r={r} isOpen={false} />)}
        </section>
      )}
    </div>
  );
}
