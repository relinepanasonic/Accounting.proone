import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

import { Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

export default async function SalesCustomersPage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch clients and their deals
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone, address, crm_deals(value, stage)')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  const clientsWithStats = (clients || []).map(c => {
    let activeDeals = 0;
    let activePipeline = 0;
    let wonValue = 0;

    (c.crm_deals || []).forEach((deal: any) => {
      const val = Number(deal.value || 0);
      if (deal.stage === 'Won') {
        wonValue += val;
      } else if (deal.stage !== 'Lost') {
        activeDeals++;
        activePipeline += val;
      }
    });

    return { ...c, activeDeals, activePipeline, wonValue };
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Customers & Leads</h1>
          <p className="text-sm text-zinc-400 mt-1">Directory of all CRM contacts and their lifetime value.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientsWithStats.length === 0 ? (
          <div className="col-span-full p-8 text-center text-zinc-500">No customers found. Go to Settings &gt; Contacts to add some, or create a deal.</div>
        ) : (
          clientsWithStats.map(client => (
            <div key={client.id} className="bg-[#0e0f14] border-[#d4af37]/20 p-5 rounded-xl hover:border-[#d4af37]/40 transition-colors">
              <h3 className="font-bold text-zinc-100 text-lg mb-4">{client.name}</h3>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <Mail className="w-4 h-4 opacity-70" />
                  <span className="truncate">{client.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <Phone className="w-4 h-4 opacity-70" />
                  <span className="truncate">{client.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <MapPin className="w-4 h-4 opacity-70" />
                  <span className="truncate">{client.address || 'No address'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Active Pipeline</div>
                  <div className="text-[#d4af37] font-semibold text-sm">
                    {client.activeDeals > 0 ? formatCurrency(client.activePipeline) : 'None'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Lifetime Won</div>
                  <div className="text-emerald-400 font-semibold text-sm">
                    {formatCurrency(client.wonValue)}
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
