import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ArrowLeft, Receipt, AlertTriangle } from 'lucide-react';
import { NewExpenseForm } from '@/components/expenses/NewExpenseForm';

export const dynamic = 'force-dynamic';

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ historical?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name, company_name, contact_type')
    .order('name', { ascending: true });

  const { data: coaData } = await supabase
    .from('global_chart_of_accounts')
    .select('account_code, account_name, account_type')
    .eq('is_active', true)
    .eq('workspace_id', activeWorkspaceId)
    .order('account_code', { ascending: true });

  const isHistorical = params?.historical === 'true';

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#d4af37]" />
              <span>RECORD VENDOR EXPENSE OUTFLOW • LUXURY GOLD HUD</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              INSTANT A/P LOGGING • BRUSHED GOLD ACCENT
            </p>
          </div>
        </div>
      </div>

      {params.historical === 'true' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase">Historical Opening Balance Mode</h3>
            <p className="text-[10px] text-zinc-400 font-sans">
              This bill will be logged as historical Hutang. It will debit Retained Earnings and will NOT artificially inflate current-year expenses.
            </p>
          </div>
        </div>
      )}

        <NewExpenseForm 
        contacts={clientsData || []}
        coaAccounts={coaData || []}
        isHistorical={isHistorical} 
      />
    </div>
  );
}
