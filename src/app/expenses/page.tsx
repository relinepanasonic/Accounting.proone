import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ExpenseClientTable, ExpenseRecord } from '@/components/expenses/ExpenseClientTable';

export const dynamic = 'force-dynamic';

async function ExpensesTable() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: records, error } = await supabase
    .from('transactions')
    .select('id, due_date, transaction_date, description, category, amount, reconciled')
    .eq('workspace_id', activeWorkspaceId)
    .eq('type', 'expense')
    // Exclude Fixed Asset purchases: any category whose COA code starts with '1' (Asset range: 10xx, 12xx, 15xx etc.)
    // Real operating expenses use codes starting with '5' (COGS) or '6' (Opex)
    .not('category', 'ilike', '1%')
    .order('transaction_date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
  }

  const displayRecords: ExpenseRecord[] =
    records && records.length > 0
      ? records.map((r) => {
          const rawDesc = r.description || 'Vendor Payee';
          let vendorPart = rawDesc;
          let notesPart = '-';
          if (rawDesc.includes(' | ')) {
             const parts = rawDesc.split(' | ');
             vendorPart = parts[0];
             notesPart = parts.slice(1).join(' | ');
          } else if (rawDesc.includes(' - ')) {
             const parts = rawDesc.split(' - ');
             vendorPart = parts[0];
             notesPart = parts.slice(1).join(' - ');
          }
          return {
            id: r.id,
            date: r.due_date || r.transaction_date,
            vendor: vendorPart,
            notes: notesPart,
            category: r.category || 'Software & Operations',
            amount: Number(r.amount || 0),
            status: r.reconciled ? 'paid' : 'pending',
          };
        })
      : [];

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            UPCOMING PAYABLES & VENDOR BILLS
          </h2>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            BRUSHED GOLD ACCENTS • ALL AGENCY ROLES AUTHORIZED
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] bg-[#d4af37]/15 px-3 py-1 rounded-full border border-[#d4af37]/40">
          MONEY OUT TELEMETRY
        </span>
      </div>

      <ExpenseClientTable initialRecords={displayRecords} />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#d4af37]" />
            <span>EXPENSES • VENDOR PAYABLES & A/P OUTFLOW HUD</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono">
            ACTION-ORIENTED BILL MANAGEMENT • BRUSHED GOLD PANELS
          </p>
        </div>

        <Link
          href="/expenses/new"
          className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>RECORD NEW EXPENSE</span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl h-80 animate-pulse p-6"></div>
        }
      >
        <ExpensesTable />
      </Suspense>
    </div>
  );
}

