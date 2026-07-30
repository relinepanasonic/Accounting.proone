import React, { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { TaxDocumentManager } from '@/components/invoices/TaxDocumentManager';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TaxDocumentsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Restrict to PT Pintu Langit workspace only
  if (activeWorkspaceId !== '11111111-1111-1111-1111-111111111111') {
    redirect('/invoices');
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, issue_date, client_id, faktur_pajak_url, bukti_potong_url, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .eq('is_quotation', false)
    .order('created_at', { ascending: false });

  const mappedInvoices = (invoices || []).map(inv => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    issueDate: inv.issue_date,
    clientName: Array.isArray(inv.clients) ? (inv.clients[0] as any)?.name : (inv.clients as any)?.name || 'Unknown',
    amount: Number(inv.total_amount || 0),
    faktur_pajak_url: inv.faktur_pajak_url || null,
    bukti_potong_url: inv.bukti_potong_url || null,
  }));

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <span>TAX / PAJAK DOKUMEN</span>
          </h1>
          <p className="text-zinc-400 text-xs mt-1">Manage Faktur Pajak & Bukti Potong for each invoice.</p>
        </div>
      </div>
      
      <Suspense fallback={<div className="h-40 bg-zinc-900/50 rounded-xl animate-pulse" />}>
        <TaxDocumentManager invoices={mappedInvoices} />
      </Suspense>
    </div>
  );
}
