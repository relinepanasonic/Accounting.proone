import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getShopeeReports } from '@/app/actions/productivity';
import { ShopeeReportTracker } from '@/components/productivity/ShopeeReportTracker';
import { formatCurrency } from '@/lib/utils/currency';
import { Shield, ExternalLink, Mail, Phone, Clock, CheckCircle } from 'lucide-react';

export default async function AdminDivisionPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, activeWorkspaceName, role } = await getAuthenticatedWorkspaceContext(supabase);

  let { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone, invoices(status, total, amount_paid)')
    .eq('workspace_id', activeWorkspaceId)
    .or('contact_type.eq.client,contact_type.is.null')
    .order('name');

  const { data: userData } = await supabase.auth.getUser();

  if (role !== 'superadmin' && role !== 'founder' && clients) {
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('client_id')
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', userData.user?.id);

    if (assignments) {
      const assignedIds = new Set(assignments.map(a => a.client_id));
      clients = clients.filter(c => assignedIds.has(c.id));
    } else {
      clients = [];
    }
  }

  const clientsWithStats = (clients || []).map(c => {
    let totalPaid = 0;
    let unpaidBalance = 0;

    (c.invoices || []).forEach((inv: any) => {
      const invTotal = Number(inv.total || 0);
      const invPaid = Number(inv.amount_paid || 0);
      totalPaid += invPaid;
      if (inv.status !== 'DRAFT') {
        unpaidBalance += (invTotal - invPaid);
      }
    });

    return { ...c, totalPaid, unpaidBalance };
  });

  const reports = await getShopeeReports(7);

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]">
          <Shield className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Admin Division</h1>
          <p className="text-sm text-zinc-400 mt-1">Workspace: {activeWorkspaceName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Shopee Report Tracker & External App Link */}
        <div className="space-y-6 lg:col-span-1">
          {/* External App Link */}
          <div className="bg-gradient-to-br from-[#18233c] to-[#0e0f14] border border-blue-500/20 p-5 rounded-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ExternalLink className="w-16 h-16 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-blue-100 mb-2">Profesor Online App</h2>
            <p className="text-sm text-blue-200/70 mb-5 relative z-10">Access the primary dashboard to upload Shopee reports and manage external data.</p>
            <a 
              href="https://dashboard.profesoronline.id/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider py-2.5 px-5 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
            >
              Open Dashboard <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Shopee Report Tracker Component */}
          <ShopeeReportTracker reports={reports} />
        </div>

        {/* Right Column: Client List for Active Workspace */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-100 font-serif">Clients</h2>
            <span className="text-xs text-[#d4af37] bg-[#d4af37]/10 px-2 py-1 rounded-md font-mono border border-[#d4af37]/20">
              {clientsWithStats.length} Total
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientsWithStats.length === 0 ? (
              <div className="col-span-full p-8 text-center text-zinc-500 bg-[#0e0f14] rounded-xl border border-zinc-800">
                No clients found in this workspace.
              </div>
            ) : (
              clientsWithStats.map(client => (
                <div key={client.id} className="bg-[#0e0f14] border border-[#d4af37]/20 p-4 rounded-xl hover:border-[#d4af37]/50 transition-colors shadow-lg relative overflow-hidden">
                  {client.unpaidBalance === 0 && client.totalPaid > 0 ? (
                    <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-bl flex items-center gap-1 uppercase">
                      <CheckCircle className="w-3 h-3" /> Paid
                    </div>
                  ) : client.unpaidBalance > 0 ? (
                    <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-bl flex items-center gap-1 uppercase">
                      <Clock className="w-3 h-3" /> Pending
                    </div>
                  ) : null}

                  <h3 className="font-bold text-zinc-100 text-base mb-3 pr-16 truncate">{client.name}</h3>
                  
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Mail className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span className="truncate">{client.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Phone className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span className="truncate">{client.phone || 'No phone'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-3 border-t border-zinc-800/80">
                    <div>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase">Paid</div>
                      <div className="text-emerald-400 font-semibold text-xs">
                        {formatCurrency(client.totalPaid)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold text-zinc-500 uppercase">Balance</div>
                      <div className={`font-semibold text-xs ${client.unpaidBalance > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {formatCurrency(client.unpaidBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
