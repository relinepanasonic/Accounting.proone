import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ExpenseRowActions } from '@/components/expenses/ExpenseRowActions';

export const dynamic = 'force-dynamic';

interface ExpenseRecord {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amount: number;
  status: string;
}

async function ExpensesTable() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: records } = await supabase
    .from('transactions')
    .select('id, due_date, description, category, amount, status')
    .eq('workspace_id', activeWorkspaceId)
    .eq('is_upcoming_bill', true)
    .order('due_date', { ascending: true });

  const displayRecords: ExpenseRecord[] =
    records && records.length > 0
      ? records.map((r) => ({
          id: r.id,
          date: r.due_date || '2026-07-15',
          vendor: r.description || 'Vendor Payee',
          category: r.category || 'Software & Operations',
          amount: Number(r.amount || 0),
          status: r.status || 'pending',
        }))
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

      {displayRecords.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Expenses Recorded Yet</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">Record vendor bills, operational overhead, and recurring payables.</p>
          </div>
          <Link
            href="/expenses/new"
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" /> RECORD FIRST EXPENSE
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3">Vendor / Payee</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Amount Owed</th>
                <th className="py-3 px-3 text-center">Status Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {displayRecords.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                >
                  <td className="py-3 px-3 text-zinc-300 font-bold">
                    {item.date}
                  </td>
                  <td className="py-3 px-3 font-sans font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                    {item.vendor}
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-sans">
                    {item.category}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-extrabold text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.35)]">
                      Rp {item.amount.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <ExpenseRowActions id={item.id} status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
