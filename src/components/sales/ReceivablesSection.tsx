import React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { clientMask } from '@/lib/auth/client-privacy';
import { formatCurrency } from '@/lib/utils/currency';

/** Outstanding invoices of the active workspace. Lives under the Client tab of Sales. */
export async function ReceivablesSection({
  supabase, workspaceId, userEmail, availableWorkspaces,
}: {
  supabase: any;
  workspaceId: string;
  userEmail?: string | null;
  availableWorkspaces: any;
}) {
  const mask = clientMask({ userEmail, availableWorkspaces });

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, clients(name)')
    .eq('workspace_id', workspaceId)
    .in('status', ['sent', 'invoiced', 'partial_paid', 'overdue'])
    .order('due_date', { ascending: true });

  const totalAR = (invoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.total_amount) - Number(inv.amount_paid || 0)), 0);

  return (
    <section id="ar" className="scroll-mt-20 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-100 font-serif">Accounts Receivable</h2>
          <p className="text-sm text-zinc-400 mt-1">Outstanding invoices waiting for client payment.</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-right">
          <div className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest">Total Outstanding</div>
          <div className="text-xl font-serif font-bold text-amber-400">{formatCurrency(totalAR)}</div>
        </div>
      </div>

      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-x-auto shadow-xl">
        {!invoices || invoices.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center">
            <CheckCircle className="w-12 h-12 text-emerald-500/50 mb-3" />
            <p>All clean! You have no outstanding accounts receivable.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-400 border-b border-[#d4af37]/10">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Invoice / Client</th>
                <th className="px-6 py-4 font-bold tracking-wider">Status</th>
                <th className="px-6 py-4 font-bold tracking-wider">Due Date</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Total</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {invoices.map((inv: any) => {
                const balance = Number(inv.total_amount) - Number(inv.amount_paid || 0);
                const isOverdue = inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < new Date());
                return (
                  <tr key={inv.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/invoices/${inv.id}`} className="font-bold text-[#d4af37] hover:underline mb-1 block">
                        {inv.invoice_number || 'Draft'}
                      </Link>
                      <div className="text-xs text-zinc-300">{mask.name(inv.clients?.name, inv.assigned_workspace_id, 'Unknown Client')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${
                        isOverdue ? 'bg-red-500/10 text-red-400 border-red-500/20' : inv.status === 'partial_paid' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {isOverdue ? 'Overdue' : inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4 text-right text-zinc-400">{formatCurrency(Number(inv.total_amount))}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-semibold ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>{formatCurrency(balance)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
