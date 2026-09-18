import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { formatCurrency } from '@/lib/utils/currency';
import { updateDealStage } from '@/app/actions/sales';
import { User, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { NewLeadModal } from '@/components/sales/NewLeadModal';

export default async function SalesLeadsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch only deals in 'Lead' stage
  const { data: leads } = await supabase
    .from('crm_deals')
    .select('*, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .eq('stage', 'Lead')
    .order('created_at', { ascending: false });
    
  // Fetch clients for the NewLeadModal
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Leads Database</h1>
          <p className="text-sm text-zinc-400 mt-1">New leads that need to be qualified. Convert them to warm leads to move them to the pipeline.</p>
        </div>
        <NewLeadModal clients={clients || []} />
      </div>

      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-xl">
        {(!leads || leads.length === 0) ? (
          <div className="p-8 text-center text-zinc-500">No new leads found. All leads have been processed.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-400 border-b border-[#d4af37]/10">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Lead Info</th>
                <th className="px-6 py-4 font-bold tracking-wider">Client</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Value (Rp)</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-100 mb-1">{lead.title}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(lead.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <User className="w-4 h-4 text-[#d4af37]/70" />
                      {lead.clients?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-[#d4af37] font-semibold">
                      {formatCurrency(lead.value)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <form action={async () => {
                      'use server';
                      await updateDealStage(lead.id, 'Contacted');
                    }}>
                      <button 
                        type="submit"
                        className="inline-flex items-center gap-2 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-[#d4af37]/20"
                      >
                        Convert to Warm <ArrowRight className="w-3 h-3" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
