import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus, FileText, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export const dynamic = 'force-dynamic';

async function QuotationsTableServer() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch from dedicated quotations table if exists
  let quotationsList: any[] = [];
  const { data: quoRows, error: quoErr } = await supabase
    .from('quotations')
    .select('id, quotation_number, status, issue_date, valid_until, client_id, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .order('created_at', { ascending: false });

  if (!quoErr && quoRows) {
    quotationsList = quoRows.map((q) => {
      const clientObj = Array.isArray(q.clients) ? q.clients[0] : q.clients;
      return {
        id: q.id,
        number: q.quotation_number,
        clientName: clientObj?.name || 'Prospective Client',
        issueDate: q.issue_date ? new Date(q.issue_date).toLocaleDateString('id-ID') : '15/07/2026',
        validUntil: q.valid_until ? new Date(q.valid_until).toLocaleDateString('id-ID') : '30/07/2026',
        status: q.status || 'draft',
      };
    });
  }

  // Also fetch any fallback quotations stored in invoices table with status = 'quotation'
  const { data: invRows } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, issue_date, due_date, client_id, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .eq('status', 'quotation')
    .order('created_at', { ascending: false });

  if (invRows && invRows.length > 0) {
    const fallbackList = invRows.map((inv) => {
      const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      return {
        id: inv.id,
        number: inv.invoice_number,
        clientName: clientObj?.name || 'Prospective Client',
        issueDate: inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('id-ID') : '15/07/2026',
        validUntil: inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '30/07/2026',
        status: 'quotation',
      };
    });
    // Deduplicate by ID
    const existingIds = new Set(quotationsList.map((x) => x.id));
    for (const fb of fallbackList) {
      if (!existingIds.has(fb.id)) {
        quotationsList.push(fb);
      }
    }
  }

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            PROSPECTIVE CLIENT PITCH & QUOTATION REGISTRY
          </h2>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            LUXURY GOLD TELEMETRY • PITCH PROPOSALS & ITEM MENU GENERATOR WITHOUT TOTALS
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] bg-[#d4af37]/15 px-3 py-1 rounded-full border border-[#d4af37]/40">
          PITCH GENERATOR MATRIX
        </span>
      </div>

      {quotationsList.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Quotations Generated Yet</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">
              Create professional product & service pitches to present to new prospective clients without calculating totals.
            </p>
          </div>
          <Link
            href="/quotations/new"
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" /> CREATE YOUR FIRST QUOTATION
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
                <th className="py-3 px-3">Quotation ID</th>
                <th className="py-3 px-3">Prospective Client</th>
                <th className="py-3 px-3">Quote Date</th>
                <th className="py-3 px-3">Valid Until</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {quotationsList.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-900/40 transition-colors group">
                  <td className="py-3.5 px-3 font-bold text-[#f5d77f]">
                    <Link href={`/quotations/${q.id}`} className="hover:underline">
                      {q.number}
                    </Link>
                  </td>
                  <td className="py-3.5 px-3 font-sans text-white font-semibold">
                    {q.clientName}
                  </td>
                  <td className="py-3.5 px-3 text-zinc-300">{q.issueDate}</td>
                  <td className="py-3.5 px-3 text-zinc-300">{q.validUntil}</td>
                  <td className="py-3.5 px-3 text-center">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[#f5d77f] hover:border-[#d4af37] text-[11px] font-sans transition-all"
                    >
                      <span>View Pitch PDF</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-xl font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#d4af37]" />
            <span>QUOTATIONS & PITCH PROPOSAL HUB</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono mt-0.5">
            PITCHING ENGINE TO NEW CLIENTS • PRODUCT & PRICE SELECTION MENU
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="gold-btn inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 shrink-0"
        >
          <Plus className="w-4 h-4 text-black" /> NEW PITCH QUOTATION
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl p-12 text-center text-xs font-mono text-[#f5d77f]">
            LOADING QUOTATIONS REGISTRY...
          </div>
        }
      >
        <QuotationsTableServer />
      </Suspense>
    </div>
  );
}
