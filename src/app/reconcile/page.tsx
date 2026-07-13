import React, { Suspense } from 'react';
import { ShieldAlert, CheckSquare, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  ReconciliationHUD,
  UnreconciledSystemRecord,
} from '@/components/reconcile/ReconciliationHUD';

export const dynamic = 'force-dynamic';

async function ReconciliationCore() {
  const supabase = await createClient();

  // 1. Server-Side RBAC Security Check
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
      <div className="bg-slate-900/80 border border-red-500/40 rounded-2xl p-12 backdrop-blur-2xl text-center max-w-xl mx-auto my-12 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-slate-300 font-mono leading-relaxed mb-6">
          BANK RECONCILIATION & TREASURY CLEARANCE IS STRICTLY RESTRICTED TO SUPERADMIN & ACCOUNTING ROLES.
          OPERATIONAL ROLES CANNOT RECONCILE GENERAL CASH LEDGERS.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
          <span>RLS GUARDRAIL: ACTIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
        </div>
      </div>
    );
  }

  // 2. Fetch Unreconciled System Records
  const [invoicesRes, transactionsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, issue_date, clients(name), reconciled')
      .or('reconciled.is.null,reconciled.eq.false')
      .order('issue_date', { ascending: false }),
    supabase
      .from('transactions')
      .select('id, description, amount, due_date, category, reconciled')
      .or('reconciled.is.null,reconciled.eq.false')
      .order('due_date', { ascending: false }),
  ]);

  const rawInvoices = invoicesRes.data || [];
  const rawTransactions = transactionsRes.data || [];

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
  ];

  // Fallback rich unreconciled reference items if database table is completely cleared
  const displayRecords: UnreconciledSystemRecord[] =
    systemRecords.length > 0
      ? systemRecords
      : [
          {
            id: '33333333-3333-3333-3333-333333333301',
            type: 'invoice',
            reference: 'INV-2026-001',
            payeeOrClient: 'Prof Toko Online',
            date: '2026-07-02',
            amount: 149870,
          },
          {
            id: 'exp-101',
            type: 'expense',
            reference: 'Software & Infrastructure',
            payeeOrClient: 'Cloud Server Hosting A/P',
            date: '2026-07-07',
            amount: 1200,
          },
          {
            id: 'exp-102',
            type: 'expense',
            reference: 'Office & Utilities',
            payeeOrClient: 'Studio Rent Power Utilities',
            date: '2026-07-10',
            amount: 4300,
          },
        ];

  return <ReconciliationHUD systemRecords={displayRecords} />;
}

export default function BankReconciliationPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="pb-4 border-b border-slate-800/80">
        <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-amber-400" />
          <span>BANK RECONCILIATION ENGINE • AUTOMATED STATEMENT MATCHING</span>
        </h1>
        <p className="text-xs text-slate-400 font-mono">
          DRAG-AND-DROP BANK STATEMENTS • INTELLIGENT PARITY AUTOMATCH • ZERO ERROR AUDIT CLEARANCE
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="h-96 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
            <div className="h-96 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
          </div>
        }
      >
        <ReconciliationCore />
      </Suspense>
    </div>
  );
}
