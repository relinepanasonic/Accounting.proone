import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { formatCurrency } from '@/lib/utils/currency';
import { Mail, Phone, MapPin, CheckCircle, Clock } from 'lucide-react';

export default async function SalesClientsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch clients along with their invoices
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone, address, invoices(status, total, amount_paid)')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  const clientsWithStats = (clients || []).map(c => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let unpaidBalance = 0;
    let paidInvoicesCount = 0;

    (c.invoices || []).forEach((inv: any) => {
      const invTotal = Number(inv.total || 0);
      const invPaid = Number(inv.amount_paid || 0);
      
      totalInvoiced += invTotal;
      totalPaid += invPaid;
      
      if (inv.status === 'PAID') {
        paidInvoicesCount++;
      } else if (inv.status !== 'DRAFT') {
        unpaidBalance += (invTotal - invPaid);
      }
    });

    return { ...c, totalInvoiced, totalPaid, unpaidBalance, paidInvoicesCount };
  }).filter(c => c.totalInvoiced > 0); // Only show clients with actual invoices

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Verified Clients</h1>
          <p className="text-sm text-zinc-400 mt-1">Clients who have been invoiced. Track their payment status and lifetime value.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientsWithStats.length === 0 ? (
          <div className="col-span-full p-8 text-center text-zinc-500 bg-[#0e0f14] rounded-xl border border-zinc-800">
            No active clients with invoices found.
          </div>
        ) : (
          clientsWithStats.map(client => (
            <div key={client.id} className="bg-[#0e0f14] border border-[#d4af37]/20 p-5 rounded-2xl hover:border-[#d4af37]/50 transition-colors shadow-lg relative overflow-hidden">
              {client.unpaidBalance === 0 && client.totalPaid > 0 ? (
                <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3" /> Fully Paid
                </div>
              ) : client.unpaidBalance > 0 ? (
                <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-400 text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 uppercase tracking-wider">
                  <Clock className="w-3 h-3" /> Pending Payment
                </div>
              ) : null}

              <h3 className="font-bold text-zinc-100 text-lg mb-4 mt-2 pr-20">{client.name}</h3>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <Mail className="w-4 h-4 opacity-70" />
                  <span className="truncate">{client.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <Phone className="w-4 h-4 opacity-70" />
                  <span className="truncate">{client.phone || 'No phone'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/80">
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Lifetime Paid</div>
                  <div className="text-emerald-400 font-semibold text-sm">
                    {formatCurrency(client.totalPaid)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Balance Due</div>
                  <div className={`font-semibold text-sm ${client.unpaidBalance > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {formatCurrency(client.unpaidBalance)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
