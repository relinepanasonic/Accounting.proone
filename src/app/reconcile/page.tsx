import React, { Suspense } from 'react';
import { ShieldAlert, CheckSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  ReconciliationHUD,
  UnreconciledSystemRecord,
} from '@/components/reconcile/ReconciliationHUD';

import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export const dynamic = 'force-dynamic';

async function ReconciliationCore() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasClearance = true;

  if (user) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (member && member.role === 'admin') {
      hasClearance = false;
    }
  }

  if (!hasClearance) {
    return (
      <div className="gold-glass-panel border-red-500/40 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-zinc-300 font-mono leading-relaxed mb-6">
          BANK RECONCILIATION IS STRICTLY RESTRICTED TO SUPERADMIN & ACCOUNTING ROLES.
        </p>
      </div>
    );
  }

  const [invoicesRes, transactionsRes, payrollRes, bankRes, workspaceRes, coaRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, issue_date, clients(name), reconciled, workspace_id, assigned_workspace_id')
      .or(`workspace_id.eq.${activeWorkspaceId},assigned_workspace_id.eq.${activeWorkspaceId}`)
      .or('reconciled.is.null,reconciled.eq.false')
      .order('issue_date', { ascending: false }),
    supabase
      .from('transactions')
      .select('id, description, amount, due_date, category, reconciled, workspace_id')
      .eq('workspace_id', activeWorkspaceId)
      .or('reconciled.is.null,reconciled.eq.false')
      .order('due_date', { ascending: false }),
    supabase
      .from('payroll')
      .select('id, employee_name, total_payment, pay_period_end, status, workspace_id')
      .eq('workspace_id', activeWorkspaceId)
      .eq('status', 'draft')
      .order('pay_period_end', { ascending: false }),
    supabase
      .from('workspace_bank_accounts')
      .select('id, bank_name, account_number, account_holder')
      .eq('workspace_id', activeWorkspaceId)
      .order('is_default', { ascending: false }),
    supabase
      .from('workspaces')
      .select('name, payment_instructions')
      .eq('id', activeWorkspaceId)
      .single(),
    supabase
      .from('global_chart_of_accounts')
      .select('account_code, account_name, account_type')
      .eq('is_active', true)
      .order('account_code', { ascending: true })
  ]);

  const rawInvoices = invoicesRes.data || [];
  const rawTransactions = transactionsRes.data || [];
  const rawPayroll = payrollRes.data || [];
  let bankAccounts = bankRes.data || [];
  const ws = workspaceRes.data;
  const coaAccounts = coaRes.data || [];

  if (bankAccounts.length === 0 && ws?.payment_instructions) {
    const lines = ws.payment_instructions.split('\n').filter((l: string) => l.trim().length > 0);
    if (lines.length > 0) {
      bankAccounts = lines.map((line: string, idx: number) => ({
        id: `temp-legacy-${idx}`,
        bank_name: idx === 0 ? 'Bank Account' : `Bank Account (${idx + 1})`,
        account_number: line.trim(),
        account_name: ws.name || 'Workspace',
        is_default: idx === 0,
      }));
    }
  }

  const systemRecords: UnreconciledSystemRecord[] = [
    ...rawInvoices.map((inv) => {
      const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      return {
        id: inv.id,
        type: 'invoice' as const,
        reference: inv.invoice_number || 'INV-REF',
        payeeOrClient: clientObj?.name || 'Client Payee',
        date: inv.issue_date || '2026-07-02',
        amount: Number(inv.total_amount || 0),
      };
    }),
    ...rawTransactions.map((tx) => ({
      id: tx.id,
      type: 'expense' as const,
      reference: tx.category || 'EXPENSE-REF',
      payeeOrClient: tx.description || 'Vendor Payee',
      date: tx.due_date || '2026-07-07',
      amount: Number(tx.amount || 0),
    })),
    ...rawPayroll.map((pr) => ({
      id: pr.id,
      type: 'payroll' as const,
      reference: 'PAYROLL-RUN',
      payeeOrClient: pr.employee_name || 'Employee',
      date: pr.pay_period_end || '2026-01-25',
      amount: Number(pr.total_payment || 0),
    })),
  ];

  return <ReconciliationHUD systemRecords={systemRecords} bankAccounts={bankAccounts} coaAccounts={coaAccounts} />;
}

export default function BankReconciliationPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      <div className="pb-4 border-b border-[#d4af37]/20">
        <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[#d4af37]" />
          <span>BANK RECONCILIATION ENGINE • AUTOMATED STATEMENT MATCHING</span>
        </h1>
        <p className="text-xs text-[#d4af37] font-mono">
          BRUSHED GOLD AUTOMATCH FEED • PARITY CLEARANCE HUD
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="h-96 gold-glass-panel rounded-2xl"></div>
            <div className="h-96 gold-glass-panel rounded-2xl"></div>
          </div>
        }
      >
        <ReconciliationCore />
      </Suspense>
    </div>
  );
}
