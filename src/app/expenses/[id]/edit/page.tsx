import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { NewExpenseForm } from '@/components/expenses/NewExpenseForm';

export const dynamic = 'force-dynamic';

export default async function EditExpensePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: expenseRecord } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', activeWorkspaceId)
    .single();

  if (!expenseRecord) {
    notFound();
  }

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
              <Edit3 className="w-5 h-5 text-[#d4af37]" />
              <span>Expense</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              MODIFY A/P LOGGING • BRUSHED GOLD ACCENT
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <NewExpenseForm 
          contacts={clientsData || []} 
          coaAccounts={coaData || []} 
          initialData={expenseRecord} 
        />
      </div>
    </div>
  );
}
