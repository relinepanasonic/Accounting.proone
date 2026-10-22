import React, { Suspense } from 'react';
import { FileWarning } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { ReconcileTabs } from '@/components/reconcile/ReconcileTabs';
import { UnpaidInvoiceTable, type UnpaidInvoice } from '@/components/reconcile/UnpaidInvoiceTable';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // a heavy page may take more than the default 10 seconds on Vercel

async function loadUnpaid() {
  const supabase = await createClient();
  const { activeWorkspaceId, userEmail, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);
  const mask = clientMask({ userEmail, availableWorkspaces });

  const [{ data: invoices }, { data: banks }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, issue_date, due_date, assigned_workspace_id, clients(name)')
      .eq('workspace_id', activeWorkspaceId)
      .eq('is_quotation', false)
      .order('issue_date', { ascending: false }),
    supabase.from('workspace_bank_accounts').select('id, bank_name, account_number').eq('workspace_id', activeWorkspaceId).order('is_default', { ascending: false }),
  ]);

  const rows: UnpaidInvoice[] = (invoices || [])
    .map((inv: any) => {
      const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.amount_paid || 0);
      return {
        id: inv.id as string,
        number: (inv.invoice_number || 'INV') as string,
        client: mask.name(clientObj?.name, inv.assigned_workspace_id, 'Client') as string,
        date: String(inv.issue_date || '').slice(0, 10),
        due: String(inv.due_date || '').slice(0, 10),
        total,
        paid,
        balance: Math.max(0, total - paid),
        status: String(inv.status || '').toLowerCase(),
      };
    })
    .filter((i) => i.balance > 0 && !['draft', 'cancelled', 'void', 'canceled', 'paid'].includes(i.status));

  return <UnpaidInvoiceTable rows={rows} banks={(banks || []).map((b: any) => ({ id: b.id as string, name: `${b.bank_name || 'Bank'} | ${b.account_number || ''}` }))} />;
}

/** A failure shows what failed instead of a blank crash page. */
async function UnpaidCore() {
  try {
    return await loadUnpaid();
  } catch (err: any) {
    console.error('[UnpaidInvoice] failed:', err);
    return (
      <div className="gold-glass-panel rounded-2xl p-8 text-center">
        <p className="mb-2 font-mono text-xs font-bold uppercase text-red-400">Page load error</p>
        <p className="break-all font-mono text-xs text-zinc-300">{err?.message || String(err)}</p>
      </div>
    );
  }
}

export default function UnpaidInvoicePage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      <ReconcileTabs active="unpaid" />
      <div className="pb-4 border-b border-[#d4af37]/20">
        <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><FileWarning className="h-5 w-5 text-[#d4af37]" /><span>Unpaid Invoice</span></h1>
        <p className="mt-1 text-xs text-zinc-500">The money of an invoice is matched with the bank through a cash record. Mark the invoice Paid or Partial here; the payment appears in Cash Received, and you match it in Reconcile.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl gold-glass-panel" />}>
        <UnpaidCore />
      </Suspense>
    </div>
  );
}
